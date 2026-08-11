"""Mode A — compliance matrix pipeline.

Parse → enrich → assemble → export, mutating the job in place so the UI's poll
sees progress. Follows the ingest pipeline's resilience contract: never raises,
a failed chunk costs that chunk and nothing more, and a run that loses some
enrichment still exports and ends `partial`.

The load-bearing rule: requirement text comes from the PARSE, never from the
model. Enrichment output is joined on req_id and any text field it volunteers is
ignored. That is what makes the exported matrix defensible next to the customer's
own document.
"""
from __future__ import annotations

import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..config import get_settings
from ..llm import LLMError, complete_json_retry
from ..ingest.models import StageState
from . import prompts, store
from .models import (
    ComplianceResult,
    DocGenJob,
    LiveSection,
    MatrixRow,
    MatrixSection,
)
from .parse_docx import ParsedDoc, ParsedSection
from .render_csv import compliance_csv
from .render_docx import render_compliance_docx

STAGE_DEFS: list[tuple[str, str]] = [
    ("parse", "Reading requirement tables"),
    ("enrich", "Adding compliance intelligence per section"),
    ("assemble", "Joining analysis to source requirements"),
    ("export", "Rendering Word & CSV exports"),
]

# Chunk sizing: sections up to this many rows go in one call; larger ones are
# split, because a single call asked for 30 annotated rows starts dropping ids.
MAX_SECTION_ROWS = 15
CHUNK_SIZE = 12
MAX_WORKERS = 3

PLACEHOLDER = "— pending SME review"

_TITLES: dict[str, str] = {
    "product": "Product Requirements Traceability & Compliance Matrix",
    "hardware": "{product} Hardware Requirements — Compliance & Traceability Matrix",
    "software": "{product} Software Requirements — Compliance & Traceability Matrix",
    "labeling": "{product} Labeling Requirements — Compliance & Traceability Matrix",
    "generic": "{product} Requirements — Compliance & Traceability Matrix",
}

_SUBTITLES: dict[str, str] = {
    "product": "System, Functional, Performance, Alarm, Interface, Safety, Power, "
    "Connectivity, Reliability and Regulatory requirements",
    "hardware": "Hardware element requirements mapped to standards and verification",
    "software": "Software element requirements for IEC 62304 / DHF traceability — "
    "Class A/B/C assignments are illustrative pending formal safety classification",
    "labeling": "Labelling and IFU requirements mapped to symbol, content and "
    "format standards",
    "generic": "Requirements mapped to standards, verification approach and risk",
}

_SUFFIX: dict[str, str] = {
    "product": "System_Requirements_Compliance",
    "hardware": "Hardware_Requirements_Compliance",
    "software": "Software_Requirements_Compliance",
    "labeling": "Labeling_Requirements_Compliance",
    "generic": "Requirements_Compliance",
}


def initial_stages() -> list[StageState]:
    return [StageState(key=k, label=l) for k, l in STAGE_DEFS]


def _stage(job: DocGenJob, key: str) -> StageState:
    return next(s for s in job.stages if s.key == key)


def _start(job: DocGenJob, key: str) -> None:
    _stage(job, key).status = "running"


def _done(job: DocGenJob, key: str, detail: str | None = None) -> None:
    s = _stage(job, key)
    s.status = "done"
    s.detail = detail


def _fail(job: DocGenJob, key: str, detail: str) -> None:
    s = _stage(job, key)
    s.status = "failed"
    s.detail = detail


def _chunks(section: ParsedSection) -> list[list[tuple[str, str]]]:
    rows = [(r.req_id, r.text) for r in section.rows]
    if len(rows) <= MAX_SECTION_ROWS:
        return [rows]
    return [rows[i : i + CHUNK_SIZE] for i in range(0, len(rows), CHUNK_SIZE)]


def _coerce_rows(raw: object, allowed: set[str]) -> dict[str, dict]:
    """Validate enrichment output into {req_id: fields}, dropping anything unusable.

    Unknown ids are dropped rather than trusted: a model that invents an id has
    also invented the analysis attached to it. Duplicates keep the first.
    """
    out: dict[str, dict] = {}
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        req_id = str(item.get("req_id", "")).strip()
        if req_id not in allowed or req_id in out:
            continue

        level = str(item.get("risk_level", "")).strip().title()
        standards = str(item.get("standards") or "").strip()
        sw_class = str(item.get("sw_class") or "").strip().upper()
        # The reference matrices carry the 62304 class inside the standards cell
        # rather than as an eighth column.
        if sw_class in ("A", "B", "C"):
            if "62304" in standards and "(Class" not in standards:
                standards = standards.replace(
                    "IEC 62304:2006+AMD1:2015",
                    f"IEC 62304:2006+AMD1:2015 (Class {sw_class})",
                )
            elif "62304" not in standards:
                prefix = f"IEC 62304:2006+AMD1:2015 (Class {sw_class})"
                standards = f"{prefix}; {standards}" if standards else prefix

        out[req_id] = {
            "rationale": str(item.get("rationale") or "").strip() or None,
            "standards": standards or None,
            "compliance_approach": str(item.get("compliance_approach") or "").strip()
            or None,
            "risk_hazard": str(item.get("risk_hazard") or "").strip() or None,
            "risk_level": level if level in ("High", "Medium", "Low") else None,
        }
    return out


def _enrich_chunk(
    doc_type: str,
    product: str,
    section_title: str,
    rows: list[tuple[str, str]],
    missing_only: bool = False,
) -> dict[str, dict]:
    system, task = prompts.matrix_chunk_prompt(
        doc_type, product, section_title, rows, missing_only=missing_only
    )
    payload = complete_json_retry(system, task, temperature=0.2)
    return _coerce_rows(payload.get("rows"), {req_id for req_id, _ in rows})


def _filenames(result: ComplianceResult) -> tuple[str, str]:
    base = f"{store.ascii_slug(result.product_name)}_{_SUFFIX[result.doc_type]}"
    return f"{base}.docx", f"{base}.csv"


def run_matrix(job: DocGenJob, parsed: ParsedDoc) -> None:
    """Execute the compliance-matrix pipeline. Never raises."""
    started = time.monotonic()
    job.status = "running"
    job.model = get_settings().gemini_model
    failures = 0

    # ── parse (already done at the endpoint, so this reports) ─────────────────
    _start(job, "parse")
    _done(
        job,
        "parse",
        f"{parsed.row_count} requirements across {len(parsed.sections)} sections",
    )

    product = parsed.product_name
    doc_type = parsed.doc_type

    # ── enrich ────────────────────────────────────────────────────────────────
    _start(job, "enrich")
    total = len(parsed.sections)
    enriched: dict[str, dict] = {}
    completed = 0

    jobs_to_run: list[tuple[int, ParsedSection, list[tuple[str, str]]]] = []
    for index, section in enumerate(parsed.sections):
        for chunk in _chunks(section):
            jobs_to_run.append((index, section, chunk))

    # Live preview: one entry per section, filled as chunks complete. The UI
    # polls this off the job; it is cleared once the final matrix is assembled.
    job.live_sections = [
        LiveSection(title=s.title, total_rows=len(s.rows)) for s in parsed.sections
    ]
    chunks_left = Counter(index for index, _, _ in jobs_to_run)

    def _run_chunk(live: LiveSection, *args) -> dict[str, dict]:
        # "running" means a worker actually picked the chunk up, not merely queued.
        if live.status == "pending":
            live.status = "running"
        return _enrich_chunk(*args)

    def _refresh_live(index: int, section: ParsedSection) -> None:
        live = job.live_sections[index]
        live.rows = [  # rebuilt in source order — chunk completion order is irrelevant
            MatrixRow(
                req_id=r.req_id,
                requirement=r.text,  # verbatim — same construction as assemble
                enriched=True,
                **enriched[r.req_id],
            )
            for r in section.rows
            if r.req_id in enriched
        ]
        live.done_rows = len(live.rows)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(
                _run_chunk, job.live_sections[index], doc_type, product, section.title, chunk
            ): (index, section)
            for index, section, chunk in jobs_to_run
        }
        for future in as_completed(futures):
            index, section = futures[future]
            try:
                enriched.update(future.result())
            except (LLMError, Exception):
                failures += 1
            completed += 1
            _refresh_live(index, section)
            chunks_left[index] -= 1
            if chunks_left[index] == 0:
                live = job.live_sections[index]
                live.status = "done" if live.rows else "failed"
            rows_done = sum(s.done_rows for s in job.live_sections)
            secs_done = sum(1 for s in job.live_sections if s.status in ("done", "failed"))
            _stage(job, "enrich").detail = (
                f"{rows_done}/{parsed.row_count} requirements · "
                f"{secs_done}/{total} sections · {MAX_WORKERS} model calls in parallel"
            )

    if not enriched:
        job.live_sections = None
        _fail(job, "enrich", "Enrichment produced no usable rows")
        for key in ("assemble", "export"):
            _fail(job, key, "Skipped — nothing to assemble")
        job.status = "failed"
        job.error = "The model returned no usable compliance analysis."
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    detail = f"{len(enriched)} of {parsed.row_count} requirements annotated"
    if failures:
        _fail(job, "enrich", f"{detail} — {failures} batch(es) failed")
    else:
        _done(job, "enrich", detail)

    # ── assemble: one retry for whatever the model skipped ────────────────────
    _start(job, "assemble")
    n_missing = sum(
        1 for s in parsed.sections for r in s.rows if r.req_id not in enriched
    )
    if n_missing:
        _stage(job, "assemble").detail = (
            f"Re-requesting {n_missing} row(s) the model skipped"
        )
    for index, section in enumerate(parsed.sections):
        missing = [(r.req_id, r.text) for r in section.rows if r.req_id not in enriched]
        if not missing:
            continue
        try:
            enriched.update(
                _enrich_chunk(
                    doc_type, product, section.title, missing[:CHUNK_SIZE], missing_only=True
                )
            )
            _refresh_live(index, section)  # recovered rows appear in the preview too
        except Exception:
            failures += 1

    sections: list[MatrixSection] = []
    placeholders = 0
    for section in parsed.sections:
        rows: list[MatrixRow] = []
        for parsed_row in section.rows:
            fields = enriched.get(parsed_row.req_id)
            if fields:
                rows.append(
                    MatrixRow(
                        req_id=parsed_row.req_id,
                        requirement=parsed_row.text,  # verbatim — never the model's
                        enriched=True,
                        **fields,
                    )
                )
            else:
                placeholders += 1
                rows.append(
                    MatrixRow(
                        req_id=parsed_row.req_id,
                        requirement=parsed_row.text,
                        rationale=PLACEHOLDER,
                        standards=PLACEHOLDER,
                        compliance_approach=PLACEHOLDER,
                        risk_hazard=PLACEHOLDER,
                        risk_level=None,
                        enriched=False,
                    )
                )
        sections.append(MatrixSection(title=section.title, rows=rows))

    title_template = _TITLES.get(doc_type, _TITLES["generic"])
    job.matrix = ComplianceResult(
        doc_title=title_template.format(product=product),
        subtitle=_SUBTITLES.get(doc_type, _SUBTITLES["generic"]),
        doc_type=doc_type,
        product_name=product,
        source_name=parsed.source_name,
        sections=sections,
    )
    # Handoff: matrix is now authoritative; drop the live preview so it is never
    # persisted or replayed. A poll landing between these two assignments sees
    # both populated and the UI prefers `matrix`.
    job.live_sections = None
    assemble_detail = f"{parsed.row_count} rows joined"
    if placeholders:
        assemble_detail += f" · {placeholders} awaiting SME review"
    _done(job, "assemble", assemble_detail)

    # ── export ────────────────────────────────────────────────────────────────
    _start(job, "export")
    try:
        docx_name, csv_name = _filenames(job.matrix)
        artifacts = {
            docx_name: render_compliance_docx(job.matrix),
            csv_name: compliance_csv(job.matrix),
        }
        store.persist_run(job, artifacts)
        job.files = [
            store.file_info(job.job_id, docx_name, "docx", "Compliance matrix (.docx)", len(artifacts[docx_name])),
            store.file_info(job.job_id, csv_name, "csv", "Compliance matrix (.csv)", len(artifacts[csv_name])),
        ]
        _done(job, "export", f"{len(job.files)} files ready to download")
    except Exception as exc:
        failures += 1
        _fail(job, "export", f"Export failed: {exc}")

    job.status = "partial" if failures else "succeeded"
    job.duration_ms = int((time.monotonic() - started) * 1000)
    store.save_job_json(job)

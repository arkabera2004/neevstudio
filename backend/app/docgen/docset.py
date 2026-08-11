"""Mode B — concept → four-document requirement set.

Four chained calls rather than the ingest pipeline's tree: the deliverables are
flat documents with section families and cross-referenced ids, and each document
needs to see what came before it to stay consistent. Hardware and labeling read
the product document; software reads the product document plus the hardware
section titles only — enough to avoid re-specifying hardware, without dragging
the whole hardware doc into the context.

Product failure is fatal (nothing downstream has anything to trace to). Any other
document can fail and the run continues, exporting what exists.
"""
from __future__ import annotations

import io
import time
import zipfile

from ..config import get_settings
from ..ingest.models import StageState
from ..llm import complete_json_retry
from . import prompts, store
from .models import DocGenJob, DocSection, GeneratedDoc, KV, ReqRow
from .render_csv import reqset_csv
from .render_docx import render_reqset_docx

STAGE_DEFS: list[tuple[str, str]] = [
    ("product", "Generating product requirements"),
    ("hardware", "Deriving hardware requirements"),
    ("software", "Deriving software requirements"),
    ("labeling", "Deriving labelling & IFU requirements"),
    ("export", "Rendering Word, CSV & ZIP exports"),
]

_DOC_LABEL = {
    "product": "Product",
    "hardware": "Hardware",
    "software": "Software",
    "labeling": "Labeling",
}


def initial_stages() -> list[StageState]:
    return [StageState(key=k, label=l) for k, l in STAGE_DEFS]


def _stage(job: DocGenJob, key: str) -> StageState:
    return next(s for s in job.stages if s.key == key)


def _start(job: DocGenJob, key: str, detail: str | None = None) -> None:
    s = _stage(job, key)
    s.status = "running"
    if detail is not None:
        s.detail = detail


def _done(job: DocGenJob, key: str, detail: str | None = None) -> None:
    s = _stage(job, key)
    s.status = "done"
    s.detail = detail


def _fail(job: DocGenJob, key: str, detail: str) -> None:
    s = _stage(job, key)
    s.status = "failed"
    s.detail = detail


def _kvs(raw: object) -> list[KV]:
    out: list[KV] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, dict) and item.get("label"):
            out.append(KV(label=str(item["label"]), value=str(item.get("value", ""))))
        elif isinstance(item, (list, tuple)) and len(item) == 2:
            out.append(KV(label=str(item[0]), value=str(item[1])))
    return out


def _coerce_doc(raw: dict, doc_type: str, fallback_product: str) -> GeneratedDoc:
    """Validate one generated document, dropping unusable rows and sections."""
    sections: list[DocSection] = []
    seen: set[str] = set()
    for item in raw.get("sections", []) or []:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        rows: list[ReqRow] = []
        for row in item.get("rows", []) or []:
            if not isinstance(row, dict):
                continue
            req_id = str(row.get("req_id", "")).strip()
            text = str(row.get("text", "")).strip()
            if not req_id or not text or req_id in seen:
                continue
            seen.add(req_id)
            rows.append(ReqRow(req_id=req_id, text=text))
        level = 2 if str(item.get("level")) == "2" else 1
        # A level-1 section with no rows is only meaningful as the overview.
        if rows or (level == 1 and not sections):
            sections.append(
                DocSection(title=str(item["title"]).strip(), level=level, rows=rows)
            )

    if not sections:
        raise ValueError("no usable sections")

    return GeneratedDoc(
        doc_type=doc_type,  # type: ignore[arg-type]
        title=str(raw.get("title") or f"{_DOC_LABEL[doc_type]} Requirements Document"),
        product_name=str(raw.get("product_name") or fallback_product),
        context_table=_kvs(raw.get("context_table")),
        overview_table=_kvs(raw.get("overview_table")),
        purpose=str(raw.get("purpose") or ""),
        scope=str(raw.get("scope") or "") or None,
        sections=sections,
    )


def _generate(
    doc_type: str,
    concept: str,
    product_name: str | None,
    product_doc: GeneratedDoc | None = None,
    hardware_sections: list[str] | None = None,
) -> GeneratedDoc:
    system, task = prompts.docset_prompt(
        doc_type,
        concept,
        product_name=product_name,
        product_doc=product_doc,
        hardware_sections=hardware_sections,
    )
    payload = complete_json_retry(system, task, temperature=0.3)
    return _coerce_doc(payload, doc_type, product_name or "Device")


def _bundle(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in files.items():
            archive.writestr(name, payload)
    return buf.getvalue()


def run_docset(job: DocGenJob, concept: str, product_name: str | None = None) -> None:
    """Execute the four-document generation chain. Never raises."""
    started = time.monotonic()
    job.status = "running"
    job.model = get_settings().gemini_model
    failures = 0

    # ── product (fatal if it fails — everything else traces to it) ────────────
    _start(
        job,
        "product",
        "One model call from the concept — establishes the SYS/FUN/PERF ids "
        "everything downstream traces to",
    )
    try:
        product_doc = _generate("product", concept, product_name)
        job.docs.append(product_doc)
        _done(
            job,
            "product",
            f"{sum(len(s.rows) for s in product_doc.sections)} requirements "
            f"across {len(product_doc.sections)} sections",
        )
    except Exception as exc:
        _fail(job, "product", str(exc))
        for key in ("hardware", "software", "labeling", "export"):
            _fail(job, key, "Skipped — no product requirements to derive from")
        job.status = "failed"
        job.error = f"Could not generate the product requirements: {exc}"
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    resolved_name = product_doc.product_name

    # ── hardware → software → labeling ────────────────────────────────────────
    hardware_titles: list[str] = []
    n_product = sum(len(s.rows) for s in product_doc.sections)
    for doc_type in ("hardware", "software", "labeling"):
        if doc_type == "software":
            detail = (
                f"Deriving from the product document + {len(hardware_titles)} "
                "hardware section titles"
                if hardware_titles
                else "Deriving from the product document — hardware unavailable"
            )
        else:
            detail = f"Deriving from the product document ({n_product} requirements)"
        _start(job, doc_type, detail)
        try:
            doc = _generate(
                doc_type,
                concept,
                resolved_name,
                product_doc=product_doc,
                hardware_sections=hardware_titles if doc_type == "software" else None,
            )
            job.docs.append(doc)
            if doc_type == "hardware":
                hardware_titles = [s.title for s in doc.sections]
            _done(
                job,
                doc_type,
                f"{sum(len(s.rows) for s in doc.sections)} requirements "
                f"across {len(doc.sections)} sections",
            )
        except Exception as exc:
            failures += 1
            _fail(job, doc_type, f"{_DOC_LABEL[doc_type]} generation failed: {exc}")

    # ── export ────────────────────────────────────────────────────────────────
    _start(
        job,
        "export",
        f"Rendering {len(job.docs)} documents to Word & CSV, bundling the ZIP",
    )
    try:
        slug = store.ascii_slug(resolved_name)
        artifacts: dict[str, bytes] = {}
        files = []
        for doc in job.docs:
            base = f"{slug}_{_DOC_LABEL[doc.doc_type]}_Requirements"
            docx_name, csv_name = f"{base}.docx", f"{base}.csv"
            artifacts[docx_name] = render_reqset_docx(doc)
            artifacts[csv_name] = reqset_csv(doc)
            files.append((docx_name, "docx", f"{_DOC_LABEL[doc.doc_type]} (.docx)"))
            files.append((csv_name, "csv", f"{_DOC_LABEL[doc.doc_type]} (.csv)"))

        zip_name = f"{slug}_Requirement_Set.zip"
        artifacts[zip_name] = _bundle({k: v for k, v in artifacts.items()})
        files.append((zip_name, "zip", "Download all (.zip)"))

        store.persist_run(job, artifacts)
        job.files = [
            store.file_info(job.job_id, name, kind, label, len(artifacts[name]))
            for name, kind, label in files
        ]
        _done(job, "export", f"{len(job.docs)} documents · {len(job.files)} files")
    except Exception as exc:
        failures += 1
        _fail(job, "export", f"Export failed: {exc}")

    job.status = "partial" if failures else "succeeded"
    job.duration_ms = int((time.monotonic() - started) * 1000)
    store.save_job_json(job)

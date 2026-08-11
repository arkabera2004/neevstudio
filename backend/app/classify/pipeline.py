"""Staged orchestration for a CTS/CTQ classification run.

Runs in a background thread; the UI polls the job for progress. Follows the
ingest/docgen resilience contract: never raises, a failed chunk costs that
chunk and nothing more, and a run that loses some rows still completes with
fallback rows carrying the breakdown's preliminary values (flagged for review).

The load-bearing rule mirrors the matrix pipeline: statement text comes from
the BREAKDOWN, never from the model. Classification output is joined on req_id
and any text the model volunteers is ignored.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..config import get_settings
from ..ingest.models import GeneratedRequirement, StageState
from ..llm import LLMError, complete_json_retry
from . import prompts
from .models import BoundaryCondition, ClassifiedRequirement, ClassifyJob

STAGE_DEFS: list[tuple[str, str]] = [
    ("load", "Loading breakdown requirements"),
    ("boundaries", "Deriving boundary conditions from standards"),
    ("classify", "Classifying requirements per boundary condition"),
    ("assemble", "Assembling the classification register"),
]

CHUNK_SIZE = 12
MAX_WORKERS = 3

_ENUMS = {
    "classification": {"CTS", "CTQ", "Standard"},
    "risk": {"High", "Medium", "Low"},
    "confidence": {"High", "Medium", "Low"},
}


def initial_stages() -> list[StageState]:
    return [StageState(key=k, label=l) for k, l in STAGE_DEFS]


def _stage(job: ClassifyJob, key: str) -> StageState:
    return next(s for s in job.stages if s.key == key)


def _start(job: ClassifyJob, key: str) -> None:
    _stage(job, key).status = "running"


def _done(job: ClassifyJob, key: str, detail: str | None = None) -> None:
    s = _stage(job, key)
    s.status = "done"
    s.detail = detail


def _fail(job: ClassifyJob, key: str, detail: str) -> None:
    s = _stage(job, key)
    s.status = "failed"
    s.detail = detail


def _norm_enum(value: object, field: str) -> str | None:
    """'cts' -> 'CTS', 'high' -> 'High'; off-enum values are rejected."""
    text = str(value or "").strip()
    candidate = text.upper() if field == "classification" and len(text) <= 3 else text.title()
    if field == "classification" and candidate == "STANDARD":
        candidate = "Standard"
    return candidate if candidate in _ENUMS[field] else None


def _coerce_boundaries(raw: object) -> list[BoundaryCondition]:
    """Validate boundary-condition output, dropping anything unusable."""
    out: list[BoundaryCondition] = []
    seen: set[str] = set()
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        bc_id = str(item.get("id", "")).strip().upper()
        drives = _norm_enum(item.get("drives"), "classification")
        if not bc_id or bc_id in seen or drives not in ("CTS", "CTQ"):
            continue
        parameter = str(item.get("parameter") or "").strip()
        threshold = str(item.get("threshold") or "").strip()
        source = str(item.get("source") or "").strip()
        if not parameter or not threshold or not source:
            continue
        seen.add(bc_id)
        out.append(
            BoundaryCondition(
                id=bc_id, parameter=parameter, threshold=threshold,
                drives=drives, source=source,
            )
        )
    return out


def _coerce_rows(raw: object, allowed: set[str], bc_ids: set[str]) -> dict[str, dict]:
    """Validate classification output into {req_id: fields}.

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
        classification = _norm_enum(item.get("classification"), "classification")
        risk = _norm_enum(item.get("risk"), "risk")
        if req_id not in allowed or req_id in out or not classification or not risk:
            continue
        bc_id = str(item.get("bc_id") or "").strip().upper()
        out[req_id] = {
            "classification": classification,
            "risk": risk,
            "rationale": str(item.get("rationale") or "").strip() or None,
            "standard": str(item.get("standard") or "").strip() or None,
            "bc_id": bc_id if bc_id in bc_ids else None,
            "confidence": _norm_enum(item.get("confidence"), "confidence") or "Medium",
        }
    return out


def _classify_chunk(
    product: str,
    boundary_conditions: list[BoundaryCondition],
    rows: list[dict],
    bc_ids: set[str],
    missing_only: bool = False,
) -> dict[str, dict]:
    system, task = prompts.classify_chunk_prompt(
        product, boundary_conditions, rows, missing_only=missing_only
    )
    payload = complete_json_retry(system, task, temperature=0.2)
    return _coerce_rows(payload.get("rows"), {r["id"] for r in rows}, bc_ids)


def _row_from(source: GeneratedRequirement, fields: dict | None) -> ClassifiedRequirement:
    """Join model output onto the source requirement; fall back to the
    breakdown's preliminary values (flagged for review) when the model
    never returned this id."""
    if fields is None:
        return ClassifiedRequirement(
            req_id=source.id,
            statement=source.statement,
            domain=source.domain,
            module=source.module,
            classification=source.classification,
            prior_classification=source.classification,
            risk=source.risk,
            rationale="Pending SME review — the model returned no classification for this row.",
            standard=source.standard,
            confidence="Low",
            needs_review=True,
            classified=False,
        )
    changed = fields["classification"] != source.classification
    return ClassifiedRequirement(
        req_id=source.id,
        statement=source.statement,  # verbatim — never the model's
        domain=source.domain,
        module=source.module,
        classification=fields["classification"],
        prior_classification=source.classification,
        changed=changed,
        risk=fields["risk"],
        rationale=fields["rationale"],
        standard=fields["standard"] or source.standard,
        bc_id=fields["bc_id"],
        confidence=fields["confidence"],
        needs_review=changed or fields["confidence"] == "Low",
    )


def run(job: ClassifyJob, requirements: list[GeneratedRequirement]) -> None:
    """Execute the classification pass, mutating `job` in place. Never raises."""
    started = time.monotonic()
    job.status = "running"
    job.model = get_settings().gemini_model
    failures = 0
    product = job.product or "Product"

    # ── Stage 1: load (resolution happened at the endpoint; this reports) ─────
    _start(job, "load")
    _done(job, "load", f"{len(requirements)} requirements from {product} ({job.source_name})")

    # ── Stage 2: boundary conditions — one call over the whole set ────────────
    _start(job, "boundaries")
    _stage(job, "boundaries").detail = "One model call over the full requirement set"
    try:
        system, task = prompts.boundaries_prompt(
            product, [(r.id, r.statement) for r in requirements]
        )
        payload = complete_json_retry(system, task, temperature=0.2)
        job.boundary_conditions = _coerce_boundaries(payload.get("boundary_conditions"))
        if not job.boundary_conditions:
            raise LLMError("No usable boundary conditions were returned.")
        _done(job, "boundaries", f"{len(job.boundary_conditions)} boundary conditions derived")
    except (LLMError, Exception) as exc:
        # Non-fatal: classification still works, rows just carry no bc_id.
        failures += 1
        _fail(job, "boundaries", f"Continuing without boundary conditions: {exc}")

    bc_ids = {bc.id for bc in job.boundary_conditions}

    # ── Stage 3: classify — chunked fan-out ───────────────────────────────────
    _start(job, "classify")
    req_dicts = [
        {
            "id": r.id,
            "statement": r.statement,
            "domain": r.domain,
            "module": r.module,
            "classification": r.classification,
            "risk": r.risk,
        }
        for r in requirements
    ]
    chunks = [req_dicts[i : i + CHUNK_SIZE] for i in range(0, len(req_dicts), CHUNK_SIZE)]
    by_id = {r.id: r for r in requirements}
    classified: dict[str, dict] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [
            pool.submit(_classify_chunk, product, job.boundary_conditions, chunk, bc_ids)
            for chunk in chunks
        ]
        for future in as_completed(futures):
            try:
                classified.update(future.result())
            except (LLMError, Exception):
                failures += 1
            # Incremental register: rebuilt in source order so the polling UI
            # watches the table fill regardless of chunk completion order.
            job.rows = [
                _row_from(by_id[req_id], classified[req_id])
                for req_id in (r.id for r in requirements)
                if req_id in classified
            ]
            _stage(job, "classify").detail = (
                f"{len(classified)}/{len(requirements)} requirements · "
                f"{MAX_WORKERS} model calls in parallel"
            )

    if not classified:
        _fail(job, "classify", "Classification produced no usable rows")
        _fail(job, "assemble", "Skipped — nothing to assemble")
        job.status = "failed"
        job.error = "The model returned no usable classification."
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    detail = f"{len(classified)} of {len(requirements)} requirements classified"
    if failures:
        _fail(job, "classify", f"{detail} — {failures} call(s) failed")
    else:
        _done(job, "classify", detail)

    # ── Stage 4: assemble — one retry for skipped ids, then the register ──────
    _start(job, "assemble")
    missing = [r for r in req_dicts if r["id"] not in classified]
    if missing:
        _stage(job, "assemble").detail = (
            f"Re-requesting {len(missing)} row(s) the model skipped"
        )
        try:
            classified.update(
                _classify_chunk(
                    product,
                    job.boundary_conditions,
                    missing[:CHUNK_SIZE],
                    bc_ids,
                    missing_only=True,
                )
            )
        except Exception:
            failures += 1

    job.rows = [_row_from(r, classified.get(r.id)) for r in requirements]

    for bc in job.boundary_conditions:
        bc.req_ids = [row.req_id for row in job.rows if row.bc_id == bc.id]

    reclassified = sum(1 for row in job.rows if row.changed)
    review = sum(1 for row in job.rows if row.needs_review)
    cts = sum(1 for row in job.rows if row.classification == "CTS")
    job.summary = (
        f"{len(job.rows)} requirements classified — {cts} critical-to-safety, "
        f"{reclassified} reclassified from the preliminary pass, "
        f"{review} flagged for review."
    )
    _done(
        job,
        "assemble",
        f"{len(job.rows)} rows · {reclassified} reclassified · {review} for review",
    )

    job.status = "partial" if failures else "succeeded"
    job.duration_ms = int((time.monotonic() - started) * 1000)

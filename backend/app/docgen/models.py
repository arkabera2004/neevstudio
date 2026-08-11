"""Contracts for the Doc Studio pipelines.

A distinct `DocGenJob` rather than a reuse of `ingest.models.JobState`: the two
carry entirely different payloads, and the frontend `api.ts` mirrors each 1:1 —
folding both into one model would force every breakdown consumer to reason about
optional docgen fields. The two only share `StageState` (imported here) and the
single job store, which keys on `.job_id` and is model-agnostic.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..ingest.models import StageState  # shared progress-stage shape

RiskLevel = Literal["High", "Medium", "Low"]
DocType = Literal["product", "hardware", "software", "labeling", "generic"]
Mode = Literal["matrix", "docset"]
JobStatus = Literal["queued", "running", "succeeded", "partial", "failed"]


class KV(BaseModel):
    """One label/value row of a metadata table."""

    label: str
    value: str


class FileInfo(BaseModel):
    """A downloadable artifact produced by a run."""

    name: str  # on-disk filename, e.g. "PIEB_Pump_Software_Requirements.docx"
    kind: Literal["docx", "csv", "zip"]
    label: str  # button label in the UI
    url: str  # "/api/docgen/jobs/{job_id}/files/{name}"
    size_bytes: int = 0


# ── Mode A — compliance matrix ───────────────────────────────────────────────
class MatrixRow(BaseModel):
    """One enriched requirement.

    `requirement` is ALWAYS the verbatim source text (never model output). The
    five analysis fields are the model's contribution; when enrichment fails for
    a row they stay None / placeholder and `enriched` is False.
    """

    req_id: str
    requirement: str
    rationale: str | None = None
    standards: str | None = None  # sw_class folded in here, e.g. "IEC 62304... (Class C)"
    compliance_approach: str | None = None
    risk_hazard: str | None = None
    risk_level: RiskLevel | None = None
    enriched: bool = True


class MatrixSection(BaseModel):
    title: str
    rows: list[MatrixRow] = Field(default_factory=list)


class LiveSection(BaseModel):
    """Streaming preview of one section while `enrich` runs.

    Purely a UI feed: rows accumulate here as enrichment chunks complete, then
    the whole list is cleared (job.live_sections = None) the moment the final
    matrix is assembled. Never persisted, never rendered into exports.

    Thread-safety relies on build-complete-then-attach: `rows` is only ever
    replaced by a single reference assignment of a fully built list (atomic
    under CPython), and only the pipeline's as_completed loop writes it.
    """

    title: str
    total_rows: int
    done_rows: int = 0
    status: Literal["pending", "running", "done", "failed"] = "pending"
    rows: list[MatrixRow] = Field(default_factory=list)


class ComplianceResult(BaseModel):
    doc_title: str
    subtitle: str | None = None
    doc_type: DocType = "generic"
    product_name: str = "Infusion Pump"
    source_name: str = "requirements document"
    sections: list[MatrixSection] = Field(default_factory=list)


# ── Mode B — generated requirement set ───────────────────────────────────────
class ReqRow(BaseModel):
    req_id: str
    text: str  # cross-refs live inside the text: "... (Traces to: SYS-003)"


class DocSection(BaseModel):
    title: str
    level: Literal[1, 2] = 1
    rows: list[ReqRow] = Field(default_factory=list)


class GeneratedDoc(BaseModel):
    doc_type: Literal["product", "hardware", "software", "labeling"]
    title: str  # e.g. "Product Requirements Document"
    product_name: str
    context_table: list[KV] = Field(default_factory=list)
    overview_table: list[KV] = Field(default_factory=list)  # product doc only
    purpose: str = ""
    scope: str | None = None
    sections: list[DocSection] = Field(default_factory=list)


# ── Job ──────────────────────────────────────────────────────────────────────
class DocGenJob(BaseModel):
    job_id: str
    mode: Mode
    status: JobStatus = "queued"
    source_name: str
    stages: list[StageState] = Field(default_factory=list)
    matrix: ComplianceResult | None = None
    # Live enrich preview (Mode A only) — populated while `enrich` runs, cleared
    # to None once `matrix` is assembled. The UI prefers `matrix` when present.
    live_sections: list[LiveSection] | None = None
    docs: list[GeneratedDoc] = Field(default_factory=list)
    files: list[FileInfo] = Field(default_factory=list)
    # Absolute path to the on-disk run directory. Server-only — never sent to the
    # UI (downloads resolve through it, so exposing it would leak the layout).
    run_dir: str | None = Field(default=None, exclude=True)
    model: str | None = None
    duration_ms: int | None = None
    error: str | None = None


class DocsetRequest(BaseModel):
    """Concept-driven document-set generation."""

    concept: str
    product_name: str | None = None

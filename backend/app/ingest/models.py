"""Contracts for the scope-ingest pipeline.

Kept separate from `app.schemas` (which serves the agent-run endpoint) because
this is a different, richer shape: a requirement here carries the DOORS/DHF
columns a regulated-hardware team actually reviews against.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Domain = Literal["SW", "HW", "LBL"]
TreeDomain = Literal["SYS", "SW", "HW", "LBL"]
Classification = Literal["CTS", "CTQ", "Standard"]
Risk = Literal["High", "Medium", "Low"]
VerificationMethod = Literal["Test", "Inspection", "Analysis", "Demonstration"]

# Where a requirement came from. This is the comparative-evaluation payload:
# it lets the UI show, at a glance, what was in the client's document versus
# what the platform added on top.
#   extracted — stated in the source document
#   derived   — decomposed from a stated requirement
#   gap       — absent from the source but required by a standard or good practice
Origin = Literal["extracted", "derived", "gap"]


class GeneratedRequirement(BaseModel):
    id: str
    statement: str
    domain: Domain
    module: str = Field(description="HW subsystem or SW module this belongs to")
    level: int = 4
    parent_id: str | None = Field(default=None, description="Parent system PRD id")
    classification: Classification = "Standard"
    risk: Risk = "Medium"
    origin: Origin = "derived"
    rationale: str | None = None
    standard: str | None = Field(default=None, description="Governing standard + clause where known")
    risk_link: str | None = Field(default=None, description="ISO 14971 risk control linkage")
    acceptance_criteria: str | None = Field(default=None, description="Measurable pass/fail criterion")
    verification_method: VerificationMethod | None = None
    verification_id: str | None = None
    gap_note: str | None = Field(default=None, description="Why this was missing from the source")


class SystemRequirement(BaseModel):
    id: str
    statement: str
    origin: Origin = "extracted"


class TreeNode(BaseModel):
    id: str
    name: str
    domain: TreeDomain
    level: int
    reqs: int = 0
    classification: Classification | None = None
    children: list["TreeNode"] = Field(default_factory=list)


class StageState(BaseModel):
    key: str
    label: str
    status: Literal["pending", "running", "done", "failed"] = "pending"
    detail: str | None = None


class JobState(BaseModel):
    job_id: str
    status: Literal["queued", "running", "succeeded", "partial", "failed"] = "queued"
    source_kind: Literal["document", "concept"]
    source_name: str
    product: str | None = None
    stages: list[StageState] = Field(default_factory=list)
    system_requirements: list[SystemRequirement] = Field(default_factory=list)
    requirements: list[GeneratedRequirement] = Field(default_factory=list)
    tree: TreeNode | None = None
    summary: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    error: str | None = None


class GenerateRequest(BaseModel):
    """Concept-driven generation — no source document (e.g. a therapy mode)."""

    concept: str


class IngestGeneratedRequest(BaseModel):
    """Break down a document produced by a docgen (document-set) run, server-side.

    Identified by the docgen job id + file name rather than an upload, so the UI
    can chain concept → document set → breakdown without a download/re-upload.
    """

    docgen_job_id: str
    file_name: str


class BreakdownRunSummary(BaseModel):
    """One row in the persisted run-history list (see app/db.py)."""

    run_id: str
    status: Literal["succeeded", "partial"]
    source_kind: Literal["document", "concept"]
    source_name: str
    product: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    requirement_count: int = 0
    created_at: str

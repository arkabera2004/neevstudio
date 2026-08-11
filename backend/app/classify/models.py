"""Contracts for the CTS/CTQ classification pass.

A classification run consumes a completed breakdown's requirements and produces
the formal ISO 14971 criticality register: per-requirement class, risk,
rationale, boundary-condition linkage, confidence and review flags. Kept
separate from `ingest.models` because the register row is a different reviewer
artefact from a generated requirement — it carries the audit trail of a
classification decision (prior class, change flag) rather than DHF columns.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..ingest.models import Classification, Domain, Risk, StageState

Confidence = Literal["High", "Medium", "Low"]


class BoundaryCondition(BaseModel):
    """A measurable parameter whose threshold drives criticality."""

    id: str  # BC-01…
    parameter: str
    threshold: str = Field(description="Concrete figure with unit, from the grounding")
    drives: Literal["CTS", "CTQ"]
    source: str = Field(description="Whitelisted standard + clause")
    req_ids: list[str] = Field(default_factory=list)  # aggregated server-side


class ClassifiedRequirement(BaseModel):
    req_id: str
    statement: str  # verbatim from the breakdown — never model output
    domain: Domain
    module: str
    classification: Classification
    prior_classification: Classification  # what the breakdown pass said
    changed: bool = False  # computed, never model output
    risk: Risk
    rationale: str | None = None
    standard: str | None = None
    bc_id: str | None = None  # must exist in this run's boundary conditions
    confidence: Confidence = "Medium"
    needs_review: bool = False  # low confidence, class changed, or fallback row
    classified: bool = True  # False = model skipped it; carries prior values


class ClassifyJob(BaseModel):
    job_id: str
    status: Literal["queued", "running", "succeeded", "partial", "failed"] = "queued"
    source_run_id: str | None = None
    source_name: str
    product: str | None = None
    stages: list[StageState] = Field(default_factory=list)
    rows: list[ClassifiedRequirement] = Field(default_factory=list)
    boundary_conditions: list[BoundaryCondition] = Field(default_factory=list)
    summary: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    error: str | None = None


class ClassifyRequest(BaseModel):
    """Start a classification pass over a breakdown, by persisted run id or
    in-memory job id (the no-Postgres fallback)."""

    breakdown_run_id: str | None = None
    breakdown_job_id: str | None = None


class ClassificationRunSummary(BaseModel):
    """One row in the persisted run-history list (see app/db.py)."""

    run_id: str
    status: Literal["succeeded", "partial"]
    source_name: str
    product: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    requirement_count: int = 0
    created_at: str

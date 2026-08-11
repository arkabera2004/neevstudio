"""Endpoints for the CTS/CTQ classification pass.

Same job/poll/background pattern as ingest and docgen, sharing the in-memory
job store — each poll endpoint type-checks what it gets back. Completed runs
persist to Postgres (kind='classification') via the fail-soft db module.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from .. import db
from ..config import get_settings
from ..ingest import jobs
from ..ingest.models import JobState
from . import pipeline
from .models import ClassificationRunSummary, ClassifyJob, ClassifyRequest

router = APIRouter(prefix="/api/classify", tags=["classify"])


def _resolve_source(body: ClassifyRequest) -> tuple[JobState, str | None]:
    """Find the breakdown to classify: Postgres run first, then the in-memory
    job store (the no-Postgres fallback). Returns (breakdown, run_id_or_None)."""
    if body.breakdown_run_id:
        payload = db.load_payload("breakdown", body.breakdown_run_id)
        if payload is not None:
            return JobState.model_validate(payload), body.breakdown_run_id
    if body.breakdown_job_id:
        job = jobs.get(body.breakdown_job_id)
        if isinstance(job, JobState):
            return job, None
    raise HTTPException(
        status_code=404,
        detail=(
            "That breakdown could not be found. Run one on the New Breakdown page, "
            "or pick a saved run from “Previous breakdowns”."
        ),
    )


def _run_and_persist(job: ClassifyJob, requirements) -> None:
    pipeline.run(job, requirements)  # never raises — failures end the job partial/failed
    if job.status in ("succeeded", "partial"):
        db.save_run(
            job.job_id,
            "classification",
            job.source_name,
            job.model_dump(mode="json"),
            status=job.status,
            model=job.model,
            duration_ms=job.duration_ms,
        )


@router.post("", response_model=ClassifyJob)
def start_classification(body: ClassifyRequest, background: BackgroundTasks) -> ClassifyJob:
    """Classify a completed breakdown's requirements — returns a job to poll."""
    if not get_settings().has_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend.",
        )

    breakdown, run_id = _resolve_source(body)
    if not breakdown.requirements:
        raise HTTPException(
            status_code=400,
            detail="That breakdown has no requirements to classify.",
        )

    job = ClassifyJob(
        job_id=jobs.new_id(),
        source_run_id=run_id,
        source_name=breakdown.source_name,
        product=breakdown.product,
        stages=pipeline.initial_stages(),
    )
    jobs.create(job)
    background.add_task(_run_and_persist, job, breakdown.requirements)
    return job


@router.get("/jobs/{job_id}", response_model=ClassifyJob)
def get_classify_job(job_id: str) -> ClassifyJob:
    job = jobs.get(job_id)
    # The store is shared with ingest and docgen, so confirm this id is a
    # classification job rather than serving another shape through this contract.
    if not isinstance(job, ClassifyJob):
        raise HTTPException(status_code=404, detail=f"Unknown job '{job_id}'")
    return job


@router.get("/runs", response_model=list[ClassificationRunSummary])
def list_classification_run_history() -> list[ClassificationRunSummary]:
    """Persisted classification runs, newest first (empty when Postgres is off)."""
    return [ClassificationRunSummary.model_validate(r) for r in db.list_classification_runs()]


@router.get("/runs/{run_id}", response_model=ClassifyJob)
def load_classification_run(run_id: str) -> ClassifyJob:
    """Full ClassifyJob of a persisted run — a plain GET, no rehydration needed."""
    payload = db.load_payload("classification", run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Unknown run '{run_id}'")
    return ClassifyJob.model_validate(payload)

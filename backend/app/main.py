"""Veritrace AI backend — powers the AI Capability Map page.

Exposes the agent registry and a run endpoint that invokes OpenAI with the key
from backend/.env and returns a structured, renderable result.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .agents import get_agent, list_agents
from .classify.router import router as classify_router
from .compliance import router as compliance_router
from .config import get_settings
from .docgen import store as docgen_store
from .docgen.models import DocGenJob
from .docgen.router import router as docgen_router
from .ingest import jobs, pipeline
from .ingest.models import BreakdownRunSummary, GenerateRequest, IngestGeneratedRequest, JobState
from .ingest.parse import ParseError, extract_text
from .llm import LLMError, run_agent_llm
from .schemas import AgentInfo, AgentRunRecord, AgentRunSummary, RunRequest, RunResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield
    db.close()


app = FastAPI(title="Veritrace AI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Docgen — compliance matrices (Requirements Matrix page) and generated
# requirement sets (New Breakdown's "Describe a concept" mode).
app.include_router(docgen_router)

# CTS/CTQ classification pass over a completed breakdown (Classification page).
app.include_router(classify_router)

# User-created boundary-condition rules (Compliance & Standards page).
app.include_router(compliance_router)


@app.get("/api/health")
def health() -> dict:
    """Liveness + whether a key is configured (so the UI can hint at setup)."""
    return {
        "status": "ok",
        "gemini_key_configured": settings.has_key,
    }


@app.get("/api/agents", response_model=list[AgentInfo])
def get_agents() -> list[AgentInfo]:
    return [
        AgentInfo(id=a.id, name=a.name, group=a.group, status=a.status, description=a.description)
        for a in list_agents()
    ]


@app.post("/api/agents/{agent_id}/run", response_model=RunResponse)
def run_agent(agent_id: str, body: RunRequest | None = None) -> RunResponse:
    spec = get_agent(agent_id)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown agent '{agent_id}'")

    scope = (body.scope if body and body.scope else spec.default_scope).strip()

    started = time.monotonic()
    try:
        result, model = run_agent_llm(spec.role, spec.task(scope))
    except LLMError as exc:
        # 400 for the missing-key case, 502 for upstream failures.
        message = str(exc)
        status = 400 if "GEMINI_API_KEY" in message else 502
        raise HTTPException(status_code=status, detail=message) from exc

    duration_ms = int((time.monotonic() - started) * 1000)
    response = RunResponse(
        agent_id=spec.id,
        agent_name=spec.name,
        scope=scope,
        model=model,
        duration_ms=duration_ms,
        result=result,
    )
    db.save_run(
        f"run-{uuid.uuid4().hex[:12]}",
        "agent",
        scope,
        response.model_dump(mode="json"),
        agent_id=spec.id,
        model=model,
        duration_ms=duration_ms,
    )
    return response


@app.get("/api/agents/runs", response_model=list[AgentRunSummary])
def list_agent_run_history() -> list[AgentRunSummary]:
    """Persisted agent runs, newest first (empty when Postgres is not configured)."""
    return [AgentRunSummary.model_validate(r) for r in db.list_agent_runs()]


@app.get("/api/agents/runs/{run_id}", response_model=AgentRunRecord)
def get_agent_run_record(run_id: str) -> AgentRunRecord:
    payload = db.load_payload("agent", run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Unknown run '{run_id}'")
    return AgentRunRecord.model_validate({**payload, "run_id": run_id})


# ── Scope ingest → requirement breakdown ──────────────────────────────────────
# Both entry points return a job id immediately and run the pipeline in the
# background; the UI polls. Nothing is a long-lived request, which matters
# because nginx caps proxy reads at 120s (deploy/nginx.conf.template) and a real
# generation run takes 60-90s.


def _run_and_persist(job: JobState, source_text: str) -> None:
    pipeline.run(job, source_text)  # never raises — failures end the job partial/failed
    if job.status in ("succeeded", "partial"):
        db.save_run(
            job.job_id,
            "breakdown",
            job.source_name,
            job.model_dump(mode="json"),
            status=job.status,
            model=job.model,
            duration_ms=job.duration_ms,
        )


def _start_job(job: JobState, source_text: str, background: BackgroundTasks) -> JobState:
    job.stages = pipeline.initial_stages()
    jobs.create(job)
    background.add_task(_run_and_persist, job, source_text)
    return job


@app.post("/api/breakdown/ingest", response_model=JobState)
async def ingest_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
) -> JobState:
    """Upload a scope/requirements document and decompose it."""
    if not get_settings().has_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend.",
        )

    data = await file.read()
    try:
        # Parse synchronously so an unreadable file fails fast and visibly,
        # rather than surfacing as a failed stage 20 seconds later.
        text = extract_text(file.filename or "", data)
    except ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = JobState(
        job_id=jobs.new_id(),
        source_kind="document",
        source_name=file.filename or "document",
    )
    return _start_job(job, text, background)


@app.post("/api/breakdown/generate", response_model=JobState)
def generate_from_concept(body: GenerateRequest, background: BackgroundTasks) -> JobState:
    """Generate a breakdown from a product/therapy concept with no source document."""
    if not get_settings().has_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend.",
        )

    concept = (body.concept or "").strip()
    if len(concept) < 8:
        raise HTTPException(
            status_code=400,
            detail="Describe the concept in a little more detail (at least 8 characters).",
        )

    job = JobState(job_id=jobs.new_id(), source_kind="concept", source_name=concept)
    return _start_job(job, concept, background)


@app.post("/api/breakdown/ingest-generated", response_model=JobState)
def ingest_generated(body: IngestGeneratedRequest, background: BackgroundTasks) -> JobState:
    """Feed a document produced by a docset run into the breakdown pipeline.

    Reads the generated .docx straight off the run directory, so the UI can
    chain concept → document set → breakdown with one click.
    """
    if not get_settings().has_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend.",
        )

    src = jobs.get(body.docgen_job_id)
    if not isinstance(src, DocGenJob):
        # The in-memory store is capped and cleared on restart; the run itself
        # survives on disk, so point the user at the recovery path.
        raise HTTPException(
            status_code=404,
            detail=(
                "That document-set run is no longer in memory. "
                "Reload it from “Previous document sets” and try again."
            ),
        )

    try:
        path = docgen_store.resolve_file(src, body.file_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=404, detail=f"Unknown file '{body.file_name}' for that run."
        ) from exc

    try:
        text = extract_text(body.file_name, path.read_bytes())
    except ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = JobState(job_id=jobs.new_id(), source_kind="document", source_name=body.file_name)
    return _start_job(job, text, background)


@app.get("/api/breakdown/jobs/{job_id}", response_model=JobState)
def get_job(job_id: str) -> JobState:
    job = jobs.get(job_id)
    # The store is shared with docgen, so confirm this id is a breakdown job
    # rather than serving a DocGenJob through the breakdown contract.
    if not isinstance(job, JobState):
        raise HTTPException(status_code=404, detail=f"Unknown job '{job_id}'")
    return job


@app.get("/api/breakdown/runs", response_model=list[BreakdownRunSummary])
def list_breakdown_run_history() -> list[BreakdownRunSummary]:
    """Persisted breakdown runs, newest first (empty when Postgres is not configured)."""
    return [BreakdownRunSummary.model_validate(r) for r in db.list_breakdown_runs()]


@app.get("/api/breakdown/runs/{run_id}", response_model=JobState)
def load_breakdown_run(run_id: str) -> JobState:
    """Full JobState of a persisted run — a plain GET, no rehydration needed:
    unlike docgen runs, breakdown runs have no file downloads tied to a live job id."""
    payload = db.load_payload("breakdown", run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Unknown run '{run_id}'")
    return JobState.model_validate(payload)

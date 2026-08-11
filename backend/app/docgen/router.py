"""Doc Studio endpoints.

Same shape as the breakdown endpoints in main.py: validate, parse synchronously
so a bad file 400s immediately, return a job id, run the pipeline in the
background and let the UI poll. Nothing here is a long-lived request — nginx
caps proxy reads at 120s and a full document set takes longer than that.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import get_settings
from ..ingest import jobs
from ..ingest.parse import MAX_BYTES, ParseError
from . import docset, enrich, store
from .models import DocGenJob, DocsetRequest
from .parse_docx import parse_requirements_docx
from .parse_pdf import parse_requirements_pdf

router = APIRouter(prefix="/api/docgen", tags=["docgen"])

_NO_KEY = (
    "GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend."
)


def _require_key() -> None:
    if not get_settings().has_key:
        raise HTTPException(status_code=400, detail=_NO_KEY)


def _get_docgen_job(job_id: str) -> DocGenJob:
    job = jobs.get(job_id)
    if not isinstance(job, DocGenJob):
        raise HTTPException(status_code=404, detail=f"Unknown job '{job_id}'")
    return job


@router.post("/matrix", response_model=DocGenJob)
async def start_matrix(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    doc_type: str | None = Form(default=None),
) -> DocGenJob:
    """Upload a requirements document and build its compliance matrix."""
    _require_key()

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File is larger than {MAX_BYTES // (1024 * 1024)} MB.",
        )
    filename = file.filename or "requirements.docx"
    name = filename.lower()
    if name.endswith(".docx"):
        parse = parse_requirements_docx
    elif name.endswith(".pdf"):
        parse = parse_requirements_pdf
    else:
        raise HTTPException(
            status_code=400,
            detail="The compliance matrix needs a .docx or .pdf requirements document.",
        )

    try:
        parsed = parse(data, filename, doc_type)
    except ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job = DocGenJob(
        job_id=jobs.new_id(),
        mode="matrix",
        source_name=filename,
        stages=enrich.initial_stages(),
    )
    jobs.create(job)
    background.add_task(enrich.run_matrix, job, parsed)
    return job


@router.post("/docset", response_model=DocGenJob)
def start_docset(body: DocsetRequest, background: BackgroundTasks) -> DocGenJob:
    """Generate a four-document requirement set from a concept."""
    _require_key()

    concept = (body.concept or "").strip()
    if len(concept) < 8:
        raise HTTPException(
            status_code=400,
            detail="Describe the concept in a little more detail (at least 8 characters).",
        )

    job = DocGenJob(
        job_id=jobs.new_id(),
        mode="docset",
        source_name=concept,
        stages=docset.initial_stages(),
    )
    jobs.create(job)
    background.add_task(docset.run_docset, job, concept, body.product_name)
    return job


@router.get("/jobs/{job_id}", response_model=DocGenJob)
def get_docgen_job(job_id: str) -> DocGenJob:
    return _get_docgen_job(job_id)


@router.get("/jobs/{job_id}/files/{name}")
def download_file(job_id: str, name: str) -> FileResponse:
    """Stream one generated artifact. Files are written once, at export."""
    job = _get_docgen_job(job_id)
    try:
        path = store.resolve_file(job, name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown file '{name}'") from exc

    kind = next((f.kind for f in job.files if f.name == name), "docx")
    return FileResponse(
        path,
        media_type=store.MEDIA_TYPES.get(kind, "application/octet-stream"),
        filename=name,
    )


@router.get("/runs", response_model=list[store.RunSummary])
def list_runs() -> list[store.RunSummary]:
    """Previously persisted runs — the demo's recovery path."""
    return store.list_runs()


@router.post("/runs/{run_id}/load", response_model=DocGenJob)
def load_run(run_id: str) -> DocGenJob:
    """Rehydrate a persisted run into the job store so the UI can render it."""
    try:
        job = store.load_run(run_id, jobs.new_id())
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=404, detail=f"Unknown run '{run_id}'") from exc
    jobs.create(job)
    return job

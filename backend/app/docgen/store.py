"""On-disk persistence for Doc Studio runs.

Two jobs at once here. The obvious one is serving downloads: exports are written
when the run finishes and streamed on request, never regenerated. The other is
demo insurance — every completed run is kept under `backend/runs/<stamp>-<mode>/`
with its job JSON, so a network or model failure on stage can be recovered by
loading the morning's rehearsal run. That is replaying a real generation, not
faking one.

The job store is in-memory and capped at 20, and a backend restart empties it;
the runs directory is what survives, which is exactly why replay exists.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel

from .models import DocGenJob, FileInfo

RUNS_DIR = Path(__file__).resolve().parents[2] / "runs"

# Filenames we are willing to create and serve. Deliberately strict — the
# download endpoint resolves user input against this before touching disk.
SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9._ -]+$")
SAFE_RUN_ID_RE = re.compile(r"^[A-Za-z0-9._-]+$")

MEDIA_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "csv": "text/csv; charset=utf-8",
    "zip": "application/zip",
}


class RunSummary(BaseModel):
    run_id: str
    mode: str
    source_name: str
    created_at: str
    status: str
    file_count: int


def ascii_slug(text: str) -> str:
    """'PIEB Pump — épidural' → 'PIEB_Pump_epidural' (filename-safe, ASCII)."""
    normalised = (
        text.replace("—", "-").replace("–", "-").encode("ascii", "ignore").decode("ascii")
    )
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", normalised).strip("_")
    return cleaned or "Document"


def file_info(job_id: str, name: str, kind: str, label: str, size: int) -> FileInfo:
    return FileInfo(
        name=name,
        kind=kind,  # type: ignore[arg-type]
        label=label,
        url=f"/api/docgen/jobs/{job_id}/files/{name}",
        size_bytes=size,
    )


def persist_run(job: DocGenJob, artifacts: dict[str, bytes]) -> Path:
    """Write artifacts + job JSON to a fresh run directory, and set job.run_dir."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = RUNS_DIR / f"{stamp}-{job.mode}"
    run_dir.mkdir(parents=True, exist_ok=True)

    for name, payload in artifacts.items():
        if SAFE_NAME_RE.match(name):
            (run_dir / name).write_bytes(payload)

    job.run_dir = str(run_dir)
    (run_dir / "job.json").write_text(job.model_dump_json(indent=2), encoding="utf-8")
    return run_dir


def save_job_json(job: DocGenJob) -> None:
    """Re-write job.json after late mutations (final status, duration)."""
    if not job.run_dir:
        return
    path = Path(job.run_dir) / "job.json"
    try:
        path.write_text(job.model_dump_json(indent=2), encoding="utf-8")
    except OSError:
        pass  # A demo run must not fail because the disk write did.


def resolve_file(job: DocGenJob, name: str) -> Path:
    """Resolve a download request to a real path, or raise ValueError.

    Three independent checks: the name must be in our allowlisted character set,
    it must be one of the files this job actually produced, and the resolved
    path must still sit inside the run directory.
    """
    if not SAFE_NAME_RE.match(name) or not job.run_dir:
        raise ValueError("Unknown file")
    if not any(f.name == name for f in job.files):
        raise ValueError("Unknown file")

    root = Path(job.run_dir).resolve()
    target = (root / name).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise ValueError("Unknown file")
    return target


def list_runs(limit: int = 25) -> list[RunSummary]:
    """Most recent completed runs, newest first."""
    if not RUNS_DIR.is_dir():
        return []
    summaries: list[RunSummary] = []
    for path in sorted(RUNS_DIR.iterdir(), reverse=True):
        manifest = path / "job.json"
        if not path.is_dir() or not manifest.is_file():
            continue
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        summaries.append(
            RunSummary(
                run_id=path.name,
                mode=data.get("mode", "matrix"),
                source_name=data.get("source_name", path.name),
                created_at=path.name[:15],
                status=data.get("status", "succeeded"),
                file_count=len(data.get("files", [])),
            )
        )
        if len(summaries) >= limit:
            break
    return summaries


def load_run(run_id: str, new_job_id: str) -> DocGenJob:
    """Rehydrate a persisted run under a fresh job id.

    File URLs are rewritten to the new id so the download endpoint resolves, and
    run_dir points back at the persisted directory — so a replayed run serves the
    same bytes that were generated originally.
    """
    if not SAFE_RUN_ID_RE.match(run_id):
        raise ValueError("Unknown run")

    root = RUNS_DIR.resolve()
    run_dir = (root / run_id).resolve()
    if not run_dir.is_relative_to(root) or not (run_dir / "job.json").is_file():
        raise ValueError("Unknown run")

    data = json.loads((run_dir / "job.json").read_text(encoding="utf-8"))
    data["job_id"] = new_job_id
    data["run_dir"] = str(run_dir)
    for f in data.get("files", []):
        f["url"] = f"/api/docgen/jobs/{new_job_id}/files/{f['name']}"
    return DocGenJob.model_validate(data)

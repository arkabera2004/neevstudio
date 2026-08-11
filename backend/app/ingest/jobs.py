"""In-memory job store for ingest and docgen runs.

Deliberately a plain dict. The backend runs single-process (see deploy/start.sh
— uvicorn with no --workers), one demo operator at a time, and jobs are
worthless once the run is over. Adding uvicorn workers would silently break
this: a poll could land on a worker that has never heard of the job.

The store is model-agnostic — it only ever touches `.job_id` — so the breakdown
pipeline's `JobState` and Doc Studio's `DocGenJob` share one pool and one id
namespace. Each poll endpoint type-checks what it gets back.
"""
from __future__ import annotations

import threading
import uuid
from collections import OrderedDict

from pydantic import BaseModel

# Keep the last N jobs so a slow poll after a restart-free rerun still resolves.
MAX_JOBS = 20

_jobs: "OrderedDict[str, BaseModel]" = OrderedDict()
_lock = threading.Lock()


def create(job: BaseModel) -> str:
    with _lock:
        _jobs[job.job_id] = job  # type: ignore[attr-defined]
        while len(_jobs) > MAX_JOBS:
            _jobs.popitem(last=False)
    return job.job_id  # type: ignore[attr-defined,no-any-return]


def get(job_id: str) -> BaseModel | None:
    with _lock:
        return _jobs.get(job_id)


def new_id() -> str:
    return f"job-{uuid.uuid4().hex[:12]}"

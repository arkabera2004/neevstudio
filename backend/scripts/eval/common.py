"""Shared plumbing for the eval harness.

Drives the pipelines over HTTP against a running uvicorn — the same surface the
demo uses — and captures stage timelines from the poll loop.

IMPORTANT: BASE_URL pins IPv4 127.0.0.1. On this machine another application
listens on [::1]:8000, and `localhost` can resolve there first.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

BASE_URL = "http://127.0.0.1:8000"

REPO_ROOT = Path(__file__).resolve().parents[4]  # .../repos/veritrace
BACKEND_DIR = Path(__file__).resolve().parents[2]
CUSTOMER_DIR = REPO_ROOT / "PoC Data" / "Customer Files"
REFERENCE_DIR = REPO_ROOT / "PoC Data" / "Our Attempt"
EVAL_ROOT = BACKEND_DIR / "eval_runs"
LLM_LOG = EVAL_ROOT / "llm_calls.jsonl"

# The exact preset strings from src/routes/_app.doc-studio.tsx — eval concepts
# must match the demo click-path.
PRESET_PIEB = "PIEB on a PCA pump"
PRESET_VOLUMETRIC = "Smart volumetric infusion pump"

CUSTOMER_FILES = [
    "Sample_Product_Requirements_Infusion_Pump.docx",
    "Infusion_Pump_Hardware_Requirements.docx",
    "Infusion_Pump_Software_Requirements.docx",
    "Infusion_Pump_Labeling_Requirements.docx",
]


class EvalError(RuntimeError):
    pass


def client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=60.0)


def check_health(c: httpx.Client) -> dict:
    r = c.get("/api/health")
    r.raise_for_status()
    data = r.json()
    if not data.get("openai_key_configured"):
        raise EvalError("Backend reports no OpenAI key configured")
    return data


def post_matrix(c: httpx.Client, docx_path: Path, doc_type: str = "auto") -> dict:
    with docx_path.open("rb") as fh:
        r = c.post(
            "/api/docgen/matrix",
            files={"file": (docx_path.name, fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            data={"doc_type": doc_type},
        )
    r.raise_for_status()
    return r.json()


def post_docset(c: httpx.Client, concept: str, product_name: str = "") -> dict:
    r = c.post("/api/docgen/docset", json={"concept": concept, "product_name": product_name})
    r.raise_for_status()
    return r.json()


def post_breakdown_ingest(c: httpx.Client, docx_path: Path) -> dict:
    with docx_path.open("rb") as fh:
        r = c.post(
            "/api/breakdown/ingest",
            files={"file": (docx_path.name, fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
    r.raise_for_status()
    return r.json()


def poll_job(
    c: httpx.Client,
    job_id: str,
    endpoint: str = "/api/docgen/jobs/{id}",
    interval: float = 1.0,
    timeout: float = 900.0,
) -> tuple[dict, list[dict]]:
    """Poll until terminal status; return (final job, stage-transition timeline).

    Timeline entries: {"t": seconds-since-start, "stage": key, "status": ..., "detail": ...}
    recorded whenever a stage's (status, detail) pair changes.
    """
    started = time.monotonic()
    seen: dict[str, tuple[str, str | None]] = {}
    timeline: list[dict] = []
    while True:
        r = c.get(endpoint.format(id=job_id))
        r.raise_for_status()
        job = r.json()
        now = round(time.monotonic() - started, 2)
        for s in job.get("stages", []):
            state = (s["status"], s.get("detail"))
            if seen.get(s["key"]) != state:
                seen[s["key"]] = state
                timeline.append(
                    {"t": now, "stage": s["key"], "status": s["status"], "detail": s.get("detail")}
                )
        if job["status"] in ("succeeded", "partial", "failed"):
            timeline.append({"t": now, "stage": "__job__", "status": job["status"], "detail": None})
            return job, timeline
        if time.monotonic() - started > timeout:
            raise EvalError(f"Job {job_id} did not finish within {timeout}s")
        time.sleep(interval)


def download_files(c: httpx.Client, job: dict, dest: Path) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    out: list[Path] = []
    for f in job.get("files", []):
        r = c.get(f["url"])
        r.raise_for_status()
        p = dest / f["name"]
        p.write_bytes(r.content)
        out.append(p)
    return out


def read_llm_log_delta(offset: int) -> tuple[list[dict], int]:
    """Read telemetry lines appended since byte `offset`; return (lines, new offset)."""
    if not LLM_LOG.exists():
        return [], offset
    data = LLM_LOG.read_bytes()
    lines = [
        json.loads(ln)
        for ln in data[offset:].decode("utf-8", errors="replace").splitlines()
        if ln.strip()
    ]
    return lines, len(data)


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")

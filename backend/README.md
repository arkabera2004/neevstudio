# Veritrace AI Backend

FastAPI service powering the three live features: the **AI Capability Map** (per-agent
`Run now`), **New Breakdown** (document/concept → requirement tree) and **Doc Studio**
(requirements doc → compliance matrix; concept → four-document requirement set, both
exported as Word and CSV).

> Everything else in the app is still driven by frontend mock data.

## Setup

```bash
cd backend
python3 -m venv .venv               # Python 3.10–3.12
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The pinned `pydantic-core` has no wheel for Python 3.13/3.14 and will try (and fail) to
build from source — use a 3.12 or older interpreter, e.g. `python3.12 -m venv .venv`.

Add your OpenAI key to `backend/.env` (copy `.env.example`; gitignored):

```
OPENAI_API_KEY=sk-...your key...
OPENAI_MODEL=gpt-5.4-mini          # optional, this is the default
OPENAI_BASE_URL=                   # optional, any OpenAI-compatible gateway
```

`get_settings()` is `lru_cache`d, so changes to `.env` need a backend restart.

### Run history (optional Postgres)

Completed New Breakdown and Capability Map runs persist to Postgres so history survives
tab switches and backend restarts. Start the database and point the backend at it:

```bash
docker compose up -d postgres        # from the repo root
# backend/.env:
DATABASE_URL=postgresql://veritrace:veritrace@localhost:5432/veritrace
```

Persistence is **fail-soft** (`app/db.py`): with `DATABASE_URL` unset or Postgres down,
the app runs exactly as before — history endpoints just return `[]`. If Postgres comes up
*after* the backend started, restart the backend to enable history. Doc Studio
intentionally keeps its own disk store (`backend/runs/`), not Postgres — its Word/CSV
artifacts are streamed from disk.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/api/health>
- Interactive docs: <http://localhost:8000/docs>

The frontend calls `http://localhost:8000` by default. To point it elsewhere, set
`VITE_API_URL` in the frontend before `npm run dev`.

## API

| Method | Path                                    | Purpose                                              |
| ------ | --------------------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/health`                           | Liveness + whether a key is configured               |
| `GET`  | `/api/agents`                           | List the runnable agents                             |
| `POST` | `/api/agents/{id}/run`                  | Run an agent; body `{ "scope": "..." }` is optional  |
| `POST` | `/api/breakdown/ingest`                 | Upload a scope document → breakdown job              |
| `POST` | `/api/breakdown/generate`               | Concept → breakdown job                              |
| `GET`  | `/api/breakdown/jobs/{id}`              | Poll a breakdown job                                 |
| `GET`  | `/api/breakdown/runs`                   | List persisted breakdown runs (Postgres)             |
| `GET`  | `/api/breakdown/runs/{run_id}`          | Full `JobState` of a persisted run                   |
| `GET`  | `/api/agents/runs`                      | List persisted agent runs (Postgres)                 |
| `GET`  | `/api/agents/runs/{run_id}`             | Full record of one persisted agent run               |
| `POST` | `/api/docgen/matrix`                    | Upload a requirements `.docx` → compliance-matrix job |
| `POST` | `/api/docgen/docset`                    | Concept → four-document requirement-set job          |
| `GET`  | `/api/docgen/jobs/{id}`                 | Poll a Doc Studio job                                |
| `GET`  | `/api/docgen/jobs/{id}/files/{name}`    | Download one generated artifact                      |
| `GET`  | `/api/docgen/runs`                      | List persisted runs                                  |
| `POST` | `/api/docgen/runs/{run_id}/load`        | Reload a persisted run (demo recovery)               |

Both job families return a job id immediately and run in the background; the UI polls.
Nothing is a long-lived request — nginx caps proxy reads at 120s and a full document set
takes longer than that. The job store is **in-memory, single-process, capped at 20**:
do not add uvicorn `--workers`, or a poll can land on a worker that never saw the job.

Doc Studio writes each completed run to `backend/runs/<timestamp>-<mode>/` (gitignored)
with its exports and a `job.json`, which is what the reload endpoint replays.

### Response shape

Every agent returns the same generic, renderable result:

```json
{
  "agent_id": "a5",
  "agent_name": "Requirement→Test Generator",
  "scope": "CTS requirements",
  "model": "gpt-4o-mini",
  "duration_ms": 4210,
  "result": {
    "summary": "...",
    "sections": [
      { "type": "table", "title": "...", "columns": ["..."], "rows": [["..."]] },
      { "type": "cards", "title": "...", "items": [{ "title": "...", "badge": "..." }] },
      { "type": "list", "title": "...", "items": ["..."] },
      { "type": "kv", "title": "...", "pairs": [{ "key": "...", "value": "..." }] },
      { "type": "markdown", "title": "...", "text": "..." }
    ]
  }
}
```

Agents live in `app/agents.py` (ids match the frontend `agents` list). Grounding data
mirrors `src/lib/mock-data.ts` in `app/context.py`.

# Neevstudio - Product Development Intelligence

**AI-assisted product development intelligence for regulated hardware.**
A [JoulesToWatts](https://www.joulestowatts.com) product.

Neevstudio is a server-rendered web application that takes a regulated-hardware
product (e.g. a critical-care ventilator) from a written scope all the way to a
verified, cost-optimized design. It decomposes the product into software & hardware
requirements, maps them to the governing standards, classifies them by safety and
quality criticality, tracks verification against the V-model, and optimizes the
hardware bill of materials — all connected by a live requirement-to-BOM traceability
spine, with AI agents doing the heavy lifting under human approval.

Most of the application runs on realistic demo data (`src/lib/mock-data.ts`). Three
modules are wired to a live Python/OpenAI backend and produce real output on demand:
**New Breakdown** (generates a requirement breakdown from a document or a concept),
**Doc Studio** (generates customer-ready Word/CSV deliverables), and the
**AI Capability Map** (runs individual agents).

## Stack

- **Frontend:** TanStack Start (React 19 + TypeScript), TanStack Router + Query,
  Tailwind CSS v4, shadcn/ui, Recharts — server-rendered via Nitro.
- **Backend (New Breakdown, Doc Studio, AI Capability Map):** Python **FastAPI** +
  OpenAI, with `python-docx` rendering the Word deliverables.

## Modules

Organized into five areas in the sidebar:

### Lifecycle

- **Overview** — program-wide dashboard: requirements, standards coverage, verification
  trend, BOM savings, and live agent + human activity.
- **New Breakdown** — upload a **requirements/scope document** (`.docx`, `.pdf`, `.md`,
  `.txt`) — or just describe a product or therapy concept — and watch it decompose live
  into a classified hardware, software & labelling requirement tree, traced from system
  PRD down to unit level with acceptance criteria and identified gaps.
- **Doc Studio** — produces the two deliverables a customer actually receives.
  **Compliance Matrix:** upload a requirements `.docx` and every requirement ID and its
  wording are kept **verbatim** while the platform adds rationale, applicable standards,
  compliance approach, hazard and a colour-coded risk level — exported as a landscape
  seven-column Word matrix plus CSV. **Document Set:** describe a device or therapy and
  it generates a coherent Product, Hardware, Software and Labeling requirement set with
  cross-referenced IDs — four Word documents plus CSVs and a ZIP bundle.
- **Product Breakdown** — the decomposition tree from system down to part level, with
  classification, comments, and version history.
- **Compliance & Standards** — the standards library (IEC/ISO/FDA/MDR) with coverage,
  alignment status, and the boundary conditions derived from them.
- **CTS/CTQ Classification** — each requirement classified as Critical-to-Safety,
  Critical-to-Quality, or Standard against its boundary conditions and risk.
- **Verification (V-Model)** — test coverage across unit / integration / system levels
  and requirement-to-test results.
- **Hardware & BOM** — the bill of materials, per-part cost/risk/lead-time, and
  cost-by-subsystem analysis.

### Traceability

- **Traceability Explorer** — navigate the bidirectional spine linking requirements →
  standards → tests → parts.

### Platform

- **AI Capability Map** — the catalog of AI agents (decomposition, compliance mapping,
  classification, SRS/test generation, coverage analysis, BOM, price optimization,
  alternate-vendor). **Run now** invokes the live backend and returns structured output.
- **Agent Runs / Queue** — status and history of agent executions.
- **Approvals Queue** — agent proposals awaiting human sign-off.

### Reports

- **Reports & Exports** — generate and export program artifacts (e.g. the DHF).

### Settings

- **Integrations** — connections to PLM / ALM / ERP / e-signature systems.
- **Audit Trail** — an immutable log of every change, override, and agent action.
- **Settings** — program and user configuration.

## Running the project

### 1. Frontend

Needs **Node 20.19+ or 22.12+** (Vite 8 refuses to start on older versions). The repo
pins a version in `.node-version` / `.nvmrc`, so `fnm use` or `nvm use` picks the right
one; `node_modules` must be installed under that same Node or the native rolldown
binding will be missing.

```bash
fnm use              # or: nvm use
npm install
npm run dev          # Vite dev server on http://localhost:8080
```

This is enough to explore every module except the live generation on **Doc Studio**,
**New Breakdown**, and the agents on the **AI Capability Map**.

### 2. Backend (needed for Doc Studio, New Breakdown and the AI Capability Map)

Doc Studio's document generation, New Breakdown's ingest and the **Run now** buttons all
call a FastAPI service that uses OpenAI. Start it alongside the frontend:

```bash
cd backend
python3.12 -m venv .venv             # Python 3.10–3.12; 3.13+ has no pydantic-core wheel
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Add your OpenAI key to `backend/.env` (copy `backend/.env.example`; the file is
git-ignored):

```
OPENAI_API_KEY=sk-...your key...
OPENAI_MODEL=gpt-5.4-mini            # optional (default)
OPENAI_BASE_URL=                     # optional — any OpenAI-compatible gateway
```

With both running, open <http://localhost:8080>. Go to **Doc Studio** to generate a
compliance matrix or a document set, **New Breakdown** to decompose a scope document, or
**AI Capability Map** and click **Run now** on any agent. In development the frontend
proxies `/api` to the backend on `127.0.0.1:8000` automatically. See `backend/README.md`
for the API details.

**If port 8000 is already in use** (another project, or a Docker container — check with
`docker ps`), the proxy will reach the wrong service and every API call will 404. Either
free the port, or run the backend elsewhere and point the proxy at it:

```bash
uvicorn app.main:app --reload --port 8001          # terminal 1
VITE_API_PROXY=http://127.0.0.1:8001 npm run dev   # terminal 2
```

### 3. Production build (optional)

```bash
npm run build        # SSR bundle → .output/server/index.mjs
PORT=3000 npm start  # serve it (any free port)
```

## Demo runbook

Roughly 15 minutes, and it needs the backend running with a real key.

1. **Open the app.** The product name everywhere comes from one constant — start the
   frontend with `VITE_APP_NAME=ReqIQ npm run dev` to present it under the customer's
   name for the platform, or leave it unset for the default.
2. **Doc Studio → Compliance Matrix.** Drop in one of the customer's own requirements
   documents (leave the document type on *Auto-detect*). Narrate the stages as they
   advance: parse → enrich → assemble → export. Enrichment is one model call per section
   with three running in parallel, so a ~100-requirement document stays inside a minute.
   Open the results and point out that the Req ID and Requirement columns are the
   customer's own text, untouched — only the five analysis columns are generated. Download
   the `.docx` and open it beside the original deliverable.
3. **Doc Studio → Document Set.** Click the **PIEB on a PCA pump** preset and generate.
   The four stages are chained calls — hardware and labeling see the product document,
   software additionally sees the hardware section titles — which is what keeps the
   `(Traces to: SYS-0NN)` references pointing at real IDs. Walk the four result tabs and
   download the ZIP.
4. **Take a request from the room.** Type any concept into the free-text box (a syringe
   pump for the neonatal ICU, say) and show it produces a structurally identical set.

If the network or the model misbehaves mid-demo, every completed run is saved on the
backend under `backend/runs/`. **Previous runs** on the Doc Studio intake panel reloads
one — including its downloads — which replays a real generation rather than faking one.
A run that partly fails is reported as *partial* and still exports everything that
succeeded, so there is no error page to recover from.

## Project layout

```
src/
  routes/        File-based routes (overview, new-breakdown, breakdown, compliance,
                 classification, verification, hardware, traceability, capabilities,
                 agent-runs, approvals, reports, integrations, audit, settings)
  components/    Layout (Sidebar, Topbar), BreakdownTree, AgentResult, shadcn/ui
  lib/           mock-data.ts, api.ts (AI backend client), branding.ts (APP_NAME),
                 breakdown-styles.ts, theme-context.ts, utils
  styles.css     Tailwind v4 theme + self-hosted Google Sans @font-face
public/fonts/    Google Sans (self-hosted)
backend/         FastAPI service (app/, requirements.txt)
  app/agents.py  Agent registry powering the AI Capability Map
  app/ingest/    Scope-document ingest → staged requirement-breakdown pipeline
                 (parse, grounding, stages, pipeline, jobs)
  app/docgen/    Doc Studio — compliance-matrix and document-set pipelines
                 (parse_docx, enrich, docset, prompts, render_docx, render_csv,
                 store, router)
  runs/          Persisted Doc Studio runs + their exports (git-ignored)
```

> **Fonts note:** Google Sans is a Google brand typeface, bundled so the demo renders
> consistently. Swap for a licensed font before any public production use.

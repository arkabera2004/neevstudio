// Client for the NeevStudio AI backend (powers New Breakdown, Requirements
// Matrix and the AI Capability Map page).
// Defaults to same-origin "/api" — in production nginx proxies /api to the backend,
// and in dev Vite proxies /api to the local FastAPI server (see vite.config.ts).
// Override with VITE_API_URL to point at a different-origin backend.

import type { BreakdownNode } from "@/lib/mock-data";

export const API_URL = import.meta.env.VITE_API_URL ?? "";

// ── Result section types (mirror backend/app/schemas.py) ──────────────────────
export type Section =
  | { type: "table"; title: string; columns: string[]; rows: string[][] }
  | { type: "list"; title: string; items: string[] }
  | {
      type: "cards";
      title: string;
      items: { title: string; subtitle?: string; badge?: string; body?: string }[];
    }
  | { type: "kv"; title: string; pairs: { key: string; value: string }[] }
  | { type: "markdown"; title?: string; text: string };

export interface AgentResult {
  summary: string;
  sections: Section[];
}

export interface RunResponse {
  agent_id: string;
  agent_name: string;
  scope: string;
  model: string;
  duration_ms: number;
  result: AgentResult;
}

const UNREACHABLE = `Can't reach the AI backend at ${API_URL || "/api"}. Start it with: cd backend && uvicorn app.main:app --port 8000`;

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function runAgent(agentId: string, scope?: string): Promise<RunResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/agents/${agentId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope ? { scope } : {}),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<RunResponse>(res);
}

// ── Scope ingest → requirement breakdown (mirrors backend/app/ingest/models.py) ─

/** Where a requirement came from — the comparative-evaluation signal.
 *  extracted = stated in the source document
 *  derived   = decomposed from a stated requirement
 *  gap       = absent from the source but required by a standard / good practice */
export type Origin = "extracted" | "derived" | "gap";

export interface GeneratedRequirement {
  id: string;
  statement: string;
  domain: "SW" | "HW" | "LBL";
  module: string;
  level: number;
  parent_id: string | null;
  classification: "CTS" | "CTQ" | "Standard";
  risk: "High" | "Medium" | "Low";
  origin: Origin;
  rationale: string | null;
  standard: string | null;
  risk_link: string | null;
  acceptance_criteria: string | null;
  verification_method: "Test" | "Inspection" | "Analysis" | "Demonstration" | null;
  verification_id: string | null;
  gap_note: string | null;
}

export interface SystemRequirement {
  id: string;
  statement: string;
  origin: Origin;
}

export interface JobStage {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
  detail: string | null;
}

export interface JobState {
  job_id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  source_kind: "document" | "concept";
  source_name: string;
  product: string | null;
  stages: JobStage[];
  system_requirements: SystemRequirement[];
  requirements: GeneratedRequirement[];
  tree: BreakdownNode | null;
  summary: string | null;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
}

export async function ingestDocument(file: File): Promise<JobState> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/breakdown/ingest`, { method: "POST", body: form });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<JobState>(res);
}

/** Feed a document produced by a docset run into the breakdown pipeline —
 *  the backend reads the generated .docx off the run directory, no re-upload. */
export async function ingestGeneratedDocument(
  docgenJobId: string,
  fileName: string,
): Promise<JobState> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/breakdown/ingest-generated`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docgen_job_id: docgenJobId, file_name: fileName }),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<JobState>(res);
}

export async function getJob(jobId: string): Promise<JobState> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/breakdown/jobs/${jobId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<JobState>(res);
}

// ── Persisted run history (mirrors app/db.py; empty lists when Postgres is off) ─

export interface BreakdownRunSummary {
  run_id: string;
  status: "succeeded" | "partial";
  source_kind: "document" | "concept";
  source_name: string;
  product: string | null;
  model: string | null;
  duration_ms: number | null;
  requirement_count: number;
  created_at: string;
}

export interface AgentRunSummary {
  run_id: string;
  agent_id: string;
  agent_name: string;
  scope: string;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  summary: string | null;
}

export interface AgentRunRecord extends RunResponse {
  run_id: string;
  created_at: string;
}

export async function listBreakdownRuns(): Promise<BreakdownRunSummary[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/breakdown/runs`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<BreakdownRunSummary[]>(res);
}

export async function loadBreakdownRun(runId: string): Promise<JobState> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/breakdown/runs/${runId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<JobState>(res);
}

export async function listAgentRuns(): Promise<AgentRunSummary[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/agents/runs`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<AgentRunSummary[]>(res);
}

export async function getAgentRun(runId: string): Promise<AgentRunRecord> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/agents/runs/${runId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<AgentRunRecord>(res);
}

// ── Boundary-condition rules (mirrors backend/app/compliance.py) ──────────────
// User-created rules on the Compliance page; the BC-01…BC-10 rows are mock data
// and stored rules continue the series at BC-11.

export interface BoundaryRule {
  id: string;
  parameter: string;
  threshold: string;
  drives: "CTS" | "CTQ";
  source: string;
  reqs: number;
  created_at: string;
}

export type BoundaryRuleInput = Omit<BoundaryRule, "id" | "created_at">;

export async function listBoundaryRules(): Promise<BoundaryRule[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/compliance/rules`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<BoundaryRule[]>(res);
}

export async function createBoundaryRule(input: BoundaryRuleInput): Promise<BoundaryRule> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/compliance/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<BoundaryRule>(res);
}

// ── CTS/CTQ classification (mirrors backend/app/classify/models.py) ───────────
// A dedicated ISO 14971 classification pass over a completed breakdown's
// requirements: final class, risk, rationale, boundary-condition linkage,
// confidence and review flags.

export interface BoundaryCondition {
  id: string;
  parameter: string;
  threshold: string;
  drives: "CTS" | "CTQ";
  source: string;
  req_ids: string[];
}

export interface ClassifiedRequirement {
  req_id: string;
  /** Verbatim from the breakdown — never model output. */
  statement: string;
  domain: "SW" | "HW" | "LBL";
  module: string;
  classification: "CTS" | "CTQ" | "Standard";
  prior_classification: "CTS" | "CTQ" | "Standard";
  changed: boolean;
  risk: "High" | "Medium" | "Low";
  rationale: string | null;
  standard: string | null;
  bc_id: string | null;
  confidence: "High" | "Medium" | "Low";
  needs_review: boolean;
  /** False = the model skipped this row; it carries the breakdown's values. */
  classified: boolean;
}

export interface ClassifyJob {
  job_id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  source_run_id: string | null;
  source_name: string;
  product: string | null;
  stages: JobStage[];
  rows: ClassifiedRequirement[];
  boundary_conditions: BoundaryCondition[];
  summary: string | null;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
}

export interface ClassificationRunSummary {
  run_id: string;
  status: "succeeded" | "partial";
  source_name: string;
  product: string | null;
  model: string | null;
  duration_ms: number | null;
  requirement_count: number;
  created_at: string;
}

export async function startClassification(source: {
  breakdown_run_id?: string;
  breakdown_job_id?: string;
}): Promise<ClassifyJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<ClassifyJob>(res);
}

export async function getClassifyJob(jobId: string): Promise<ClassifyJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/classify/jobs/${jobId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<ClassifyJob>(res);
}

export async function listClassificationRuns(): Promise<ClassificationRunSummary[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/classify/runs`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<ClassificationRunSummary[]>(res);
}

export async function loadClassificationRun(runId: string): Promise<ClassifyJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/classify/runs/${runId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<ClassifyJob>(res);
}

// ── Docgen (mirrors backend/app/docgen/models.py) ─────────────────────────────
// Two pipelines share one job shape: `matrix` (Requirements Matrix page)
// enriches an uploaded requirements document into a compliance matrix; `docset`
// (New Breakdown's "Describe a concept" mode) generates a four-document set
// from a concept. Both stream artifacts from /api/docgen/jobs/{id}/files/{name}.

export type RiskLevel = "High" | "Medium" | "Low";
export type DocType = "product" | "hardware" | "software" | "labeling" | "generic";

export interface FileInfo {
  name: string;
  kind: "docx" | "csv" | "zip";
  label: string;
  url: string;
  size_bytes: number;
}

export interface MatrixRow {
  req_id: string;
  /** Verbatim from the source document — never model output. */
  requirement: string;
  rationale: string | null;
  standards: string | null;
  compliance_approach: string | null;
  risk_hazard: string | null;
  risk_level: RiskLevel | null;
  enriched: boolean;
}

export interface MatrixSection {
  title: string;
  rows: MatrixRow[];
}

/** Streaming preview of one section while enrichment runs (Mode A only).
 *  Cleared to null on the job the moment the final matrix is assembled. */
export interface LiveSection {
  title: string;
  total_rows: number;
  done_rows: number;
  status: "pending" | "running" | "done" | "failed";
  rows: MatrixRow[];
}

export interface ComplianceResult {
  doc_title: string;
  subtitle: string | null;
  doc_type: DocType;
  product_name: string;
  source_name: string;
  sections: MatrixSection[];
}

export interface KV {
  label: string;
  value: string;
}

export interface DocSection {
  title: string;
  level: 1 | 2;
  rows: { req_id: string; text: string }[];
}

export interface GeneratedDoc {
  doc_type: "product" | "hardware" | "software" | "labeling";
  title: string;
  product_name: string;
  context_table: KV[];
  overview_table: KV[];
  purpose: string;
  scope: string | null;
  sections: DocSection[];
}

export interface DocGenJob {
  job_id: string;
  mode: "matrix" | "docset";
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  source_name: string;
  stages: JobStage[];
  matrix: ComplianceResult | null;
  /** Live enrich preview — non-null only while a matrix run's enrich stage is in flight. */
  live_sections: LiveSection[] | null;
  docs: GeneratedDoc[];
  files: FileInfo[];
  model: string | null;
  duration_ms: number | null;
  error: string | null;
}

export interface RunSummary {
  run_id: string;
  mode: string;
  source_name: string;
  created_at: string;
  status: string;
  file_count: number;
}

export async function startMatrix(file: File, docType?: string): Promise<DocGenJob> {
  const form = new FormData();
  form.append("file", file);
  if (docType && docType !== "auto") form.append("doc_type", docType);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/docgen/matrix`, { method: "POST", body: form });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<DocGenJob>(res);
}

export async function startDocset(concept: string, productName?: string): Promise<DocGenJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/docgen/docset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, product_name: productName || null }),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<DocGenJob>(res);
}

export async function getDocgenJob(jobId: string): Promise<DocGenJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/docgen/jobs/${jobId}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<DocGenJob>(res);
}

export async function listRuns(): Promise<RunSummary[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/docgen/runs`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<RunSummary[]>(res);
}

export async function loadRun(runId: string): Promise<DocGenJob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/docgen/runs/${runId}/load`, { method: "POST" });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return unwrap<DocGenJob>(res);
}

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PreviousBreakdowns } from "@/components/PreviousBreakdowns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirements } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { classStyle, domainStyle } from "@/lib/breakdown-styles";
import {
  getClassifyJob,
  listClassificationRuns,
  loadClassificationRun,
  startClassification,
  type BoundaryCondition,
  type ClassificationRunSummary,
  type ClassifiedRequirement,
  type ClassifyJob,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app/classification")({
  validateSearch: (search: Record<string, unknown>): { breakdown?: string } => ({
    breakdown: typeof search.breakdown === "string" ? search.breakdown : undefined,
  }),
  head: () => ({
    meta: [
      { title: `CTS / CTQ Classification — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Requirement register with class, risk, standard, boundary condition, confidence and review status.",
      },
    ],
  }),
  component: ClassificationPage,
});

const POLL_MS = 1500;

type Filter = "All" | "CTS" | "CTQ" | "SW" | "HW" | "LBL";

// Static showcase for the sample register's risk chart — replaced by live
// counts the moment a classification runs.
const sampleRisk = [
  { class: "CTS", High: 82, Medium: 24, Low: 6 },
  { class: "CTQ", High: 12, Medium: 68, Low: 41 },
  { class: "Standard", High: 2, Medium: 28, Low: 165 },
];

const confidenceStyle = {
  High: "bg-success-soft text-success",
  Medium: "bg-secondary text-muted-foreground",
  Low: "bg-amber-soft text-amber-brand",
};

function ClassificationPage() {
  const { breakdown } = Route.useSearch();
  const [job, setJob] = useState<ClassifyJob | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const autoStarted = useRef(false);

  const running = job?.status === "queued" || job?.status === "running";

  const begin = useCallback(async (fn: () => Promise<ClassifyJob>) => {
    setError("");
    setStarting(true);
    try {
      setJob(await fn());
      setFilter("All");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }, []);

  // The persisted run id equals the in-memory job id, so sending both fields
  // lets the backend resolve whichever store still has the breakdown.
  const classify = useCallback(
    (id: string) =>
      begin(() => startClassification({ breakdown_run_id: id, breakdown_job_id: id })),
    [begin],
  );

  // Arriving from New Breakdown with ?breakdown=<id> starts the pass immediately.
  useEffect(() => {
    if (breakdown && !autoStarted.current) {
      autoStarted.current = true;
      classify(breakdown);
    }
  }, [breakdown, classify]);

  // Poll while the pipeline runs. Each poll is a short request, so the 120s
  // nginx proxy_read_timeout never comes into play.
  useEffect(() => {
    if (!job || !running) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const next = await getClassifyJob(job.job_id);
        if (!cancelled) setJob(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lost contact with the backend.");
          clearInterval(id);
        }
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [job, running]);

  function reset() {
    setJob(null);
    setError("");
    setFilter("All");
  }

  const rows = useMemo(() => job?.rows ?? [], [job]);
  const live = job !== null;
  const hasLbl = rows.some((r) => r.domain === "LBL");

  const stats = useMemo(() => {
    const byClass = (c: string) => rows.filter((r) => r.classification === c);
    return (["CTS", "CTQ", "Standard"] as const).map((c) => {
      const inClass = byClass(c);
      return {
        class: c,
        count: inClass.length,
        reclassified: inClass.filter((r) => r.changed).length,
        review: inClass.filter((r) => r.needs_review).length,
      };
    });
  }, [rows]);

  const liveRisk = useMemo(
    () =>
      (["CTS", "CTQ", "Standard"] as const).map((c) => {
        const inClass = rows.filter((r) => r.classification === c);
        return {
          class: c,
          High: inClass.filter((r) => r.risk === "High").length,
          Medium: inClass.filter((r) => r.risk === "Medium").length,
          Low: inClass.filter((r) => r.risk === "Low").length,
        };
      }),
    [rows],
  );

  const failed = job?.status === "failed";

  return (
    <div className="space-y-6">
      <PageHeader
        title="CTS / CTQ Classification"
        subtitle="Every requirement classified per boundary condition — a dedicated ISO 14971 pass over the generated breakdown"
        actions={
          <div className="flex items-center gap-2">
            {live && !running && (
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Back to sample
              </Button>
            )}
            <PreviousClassifications
              onLoad={(runId) => begin(() => loadClassificationRun(runId))}
            />
            <PreviousBreakdowns
              onLoad={classify}
              trigger={
                <Button size="sm" disabled={starting || running}>
                  {starting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Classify a breakdown
                </Button>
              }
            />
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-coral/30 bg-coral-soft/40 px-3.5 py-2.5 text-[13px]">
          <XCircle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!live && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            Sample register — classify one of your breakdowns to run a live ISO 14971 classification
            pass with boundary conditions, confidence and review flags.
          </span>
        </div>
      )}

      {live && running && job && <ClassifyProgress job={job} />}

      {live && !running && job && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px]",
            failed
              ? "border-coral/30 bg-coral-soft/40"
              : job.status === "partial"
                ? "border-amber-brand/30 bg-amber-soft/40"
                : "border-success/30 bg-success-soft/40",
          )}
        >
          {failed ? (
            <XCircle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
          ) : job.status === "partial" ? (
            <AlertTriangle className="h-4 w-4 text-amber-brand shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <div>
              <span className="font-medium">{job.product ?? job.source_name}</span>
              {failed ? (
                <span> — classification failed</span>
              ) : (
                <span>
                  {" "}
                  — {rows.length} requirements classified from{" "}
                  <span className="font-medium">{job.source_name}</span>
                </span>
              )}
              {job.duration_ms != null && (
                <span className="text-muted-foreground">
                  {" "}
                  · {(job.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
              {job.status === "partial" && (
                <span className="text-muted-foreground"> · some calls failed</span>
              )}
            </div>
            {(job.summary ?? job.error) && (
              <div className="text-muted-foreground mt-1">{job.summary ?? job.error}</div>
            )}
          </div>
        </div>
      )}

      {!failed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {live
            ? stats.map((s) => (
                <Card key={s.class}>
                  <CardContent className="p-5">
                    <div
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-wider",
                        s.class === "CTS" && "text-coral",
                        s.class === "CTQ" && "text-amber-brand",
                        s.class === "Standard" && "text-muted-foreground",
                      )}
                    >
                      {s.class === "CTS"
                        ? "Critical-to-Safety"
                        : s.class === "CTQ"
                          ? "Critical-to-Quality"
                          : "Standard"}
                    </div>
                    <div className="mt-1.5 tabular text-3xl font-semibold">
                      {running && rows.length === 0 ? "—" : s.count}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-1 tabular">
                      {s.reclassified} reclassified · {s.review} for review
                    </div>
                  </CardContent>
                </Card>
              ))
            : sampleKpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-5">
                    <div className={cn("text-[11px] font-medium uppercase tracking-wider", k.tone)}>
                      {k.label}
                    </div>
                    <div className="mt-1.5 tabular text-3xl font-semibold">{k.value}</div>
                    <div className="text-[12px] text-muted-foreground mt-1 tabular">{k.sub}</div>
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {!failed && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Risk distribution</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              High / Medium / Low by classification
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={live ? liveRisk : sampleRisk}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="class"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="High" stackId="a" fill="var(--color-coral)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Medium" stackId="a" fill="var(--color-amber-brand)" />
                  <Bar dataKey="Low" stackId="a" fill="var(--color-teal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {live && job && job.boundary_conditions.length > 0 && (
        <BoundaryConditionsCard conditions={job.boundary_conditions} />
      )}

      {!failed && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Requirement register</CardTitle>
              <div className="text-[11px] text-muted-foreground">
                {live
                  ? "Statement → class → standard → boundary condition → confidence → review"
                  : "Statement → class → standard → boundary condition → coverage → result"}
              </div>
            </div>
            <div className="flex gap-1">
              {(
                ["All", "CTS", "CTQ", "SW", "HW", ...(live && hasLbl ? ["LBL"] : [])] as Filter[]
              ).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                  className="h-7 px-2.5 text-[11.5px]"
                >
                  {f}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {live ? (
              <LiveRegister rows={rows} filter={filter} running={running} />
            ) : (
              <SampleRegister filter={filter} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Static showcase KPIs for the sample register (mock data, matches the rest of
// the mock-driven app; live runs replace them with honest counts).
const sampleKpis = [
  {
    label: "Critical-to-Safety",
    value: "112",
    sub: "94% verified · 6% in progress",
    tone: "text-coral",
  },
  {
    label: "Critical-to-Quality",
    value: "121",
    sub: "88% verified · 12% in progress",
    tone: "text-amber-brand",
  },
  { label: "Standard", value: "195", sub: "83% verified", tone: "text-muted-foreground" },
];

// ── Previous classifications (persisted run history) ─────────────────────────
function PreviousClassifications({ onLoad }: { onLoad: (runId: string) => void }) {
  const [runs, setRuns] = useState<ClassificationRunSummary[] | null>(null);

  async function open(isOpen: boolean) {
    if (!isOpen || runs) return;
    try {
      setRuns(await listClassificationRuns());
    } catch {
      setRuns([]);
    }
  }

  return (
    <Popover onOpenChange={open}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-3.5 w-3.5 mr-1.5" />
          Previous classifications
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-1.5">
        {runs === null && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">Loading…</div>
        )}
        {runs?.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">
            No previous classifications yet. Completed runs are saved automatically.
          </div>
        )}
        {runs?.map((run) => (
          <button
            key={run.run_id}
            onClick={() => onLoad(run.run_id)}
            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <div className="text-[12.5px] font-medium truncate">
                {run.product ?? run.source_name}
              </div>
              {run.status === "partial" && (
                <Badge className="h-4 text-[9.5px] border-0 bg-amber-soft text-amber-brand shrink-0">
                  partial
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {run.requirement_count} requirements · {new Date(run.created_at).toLocaleString()}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────
function ClassifyProgress({ job }: { job: ClassifyJob }) {
  const done = job.stages.filter((s) => s.status === "done").length;
  const pct = Math.round((done / job.stages.length) * 100);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Classifying requirements…</div>
            <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <ListChecks className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {job.product ?? job.source_name}
                {job.product && <> · {job.source_name}</>}
              </span>
            </div>
          </div>
          <div className="ml-auto tabular text-[12px] text-muted-foreground">{pct}%</div>
        </div>

        <Progress value={pct} className="h-1.5 mt-4" />

        <ul className="mt-5 space-y-2.5">
          {job.stages.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5 text-[13px]">
              {s.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : s.status === "running" ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0 mt-0.5" />
              ) : s.status === "failed" ? (
                <AlertTriangle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className={cn(s.status === "pending" && "text-muted-foreground/60")}>
                  {s.label}
                </span>
                {s.detail && (
                  <div
                    className={cn(
                      "text-[11.5px] mt-0.5",
                      s.status === "failed" ? "text-coral" : "text-muted-foreground",
                    )}
                  >
                    {s.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-md bg-muted/50 p-3 text-[11.5px] text-muted-foreground leading-relaxed">
          Real classification — boundary conditions come from one call over the full set, then the
          register fills as parallel classification calls complete below.
        </div>
      </CardContent>
    </Card>
  );
}

// ── Boundary conditions ──────────────────────────────────────────────────────
function BoundaryConditionsCard({ conditions }: { conditions: BoundaryCondition[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Boundary conditions</CardTitle>
        <div className="text-[11px] text-muted-foreground">
          Measurable thresholds that drive the CTS / CTQ decision — derived from the cited standards
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">ID</TableHead>
              <TableHead>Parameter</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead className="w-[80px]">Drives</TableHead>
              <TableHead className="w-[90px]">Linked reqs</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.map((bc) => (
              <TableRow key={bc.id}>
                <TableCell className="tabular font-medium text-[12px]">{bc.id}</TableCell>
                <TableCell className="text-[12.5px]">{bc.parameter}</TableCell>
                <TableCell className="text-[12px]">{bc.threshold}</TableCell>
                <TableCell>
                  <Badge className={cn("text-[10.5px] border-0", classStyle[bc.drives])}>
                    {bc.drives}
                  </Badge>
                </TableCell>
                <TableCell className="tabular text-[12px] text-muted-foreground">
                  {bc.req_ids.length}
                </TableCell>
                <TableCell className="tabular text-[12px] text-muted-foreground">
                  {bc.source}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Live register ────────────────────────────────────────────────────────────
function LiveRegister({
  rows,
  filter,
  running,
}: {
  rows: ClassifiedRequirement[];
  filter: Filter;
  running: boolean;
}) {
  const filtered = rows.filter((r) => {
    if (filter === "All") return true;
    if (filter === "SW" || filter === "HW" || filter === "LBL") return r.domain === filter;
    return r.classification === filter;
  });

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[12.5px] text-muted-foreground">
        {running ? "Waiting for the first classified rows…" : "No rows classified."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Statement</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Standard</TableHead>
            <TableHead>BC</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.req_id}>
              <TableCell className="tabular font-medium">{r.req_id}</TableCell>
              <TableCell
                className="max-w-[320px] truncate text-[12.5px]"
                title={r.rationale ?? undefined}
              >
                {r.statement}
              </TableCell>
              <TableCell>
                <Badge className={cn("text-[10.5px] border-0", domainStyle[r.domain])}>
                  {r.domain}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={cn("text-[10.5px] border-0", classStyle[r.classification])}>
                  {r.classification}
                </Badge>
                {r.changed && (
                  <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground tabular">
                    {r.prior_classification}
                    <ArrowRight className="h-2.5 w-2.5" />
                    {r.classification}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "text-[12px]",
                    r.risk === "High" && "text-coral",
                    r.risk === "Medium" && "text-amber-brand",
                  )}
                >
                  {r.risk}
                </span>
              </TableCell>
              <TableCell className="tabular text-[12px]">{r.standard ?? "—"}</TableCell>
              <TableCell className="tabular text-[12px] text-muted-foreground">
                {r.bc_id ?? "—"}
              </TableCell>
              <TableCell>
                <Badge className={cn("text-[10.5px] border-0", confidenceStyle[r.confidence])}>
                  {r.confidence}
                </Badge>
              </TableCell>
              <TableCell>
                {r.needs_review ? (
                  <Badge className="text-[10.5px] border-0 bg-coral-soft text-coral">Review</Badge>
                ) : (
                  <Badge className="text-[10.5px] border-0 bg-success-soft text-success">OK</Badge>
                )}
                {!r.classified && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">unclassified</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Sample register (mock showcase) ──────────────────────────────────────────
function SampleRegister({ filter }: { filter: Filter }) {
  const filtered = requirements.filter((r) => {
    if (filter === "All") return true;
    if (filter === "SW" || filter === "HW" || filter === "LBL") return r.domain === filter;
    return r.class === filter;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Statement</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Risk</TableHead>
          <TableHead>Standard</TableHead>
          <TableHead>BC</TableHead>
          <TableHead>Coverage</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular font-medium">{r.id}</TableCell>
            <TableCell className="max-w-[320px] truncate text-[12.5px]">{r.statement}</TableCell>
            <TableCell>
              <Badge className={cn("text-[10.5px] border-0", domainStyle[r.domain])}>
                {r.domain}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={cn("text-[10.5px] border-0", classStyle[r.class])}>{r.class}</Badge>
            </TableCell>
            <TableCell>
              <span
                className={cn(
                  "text-[12px]",
                  r.risk === "High" && "text-coral",
                  r.risk === "Medium" && "text-amber-brand",
                )}
              >
                {r.risk}
              </span>
            </TableCell>
            <TableCell className="tabular text-[12px]">{r.standard}</TableCell>
            <TableCell className="tabular text-[12px] text-muted-foreground">{r.bc}</TableCell>
            <TableCell className="tabular text-[12px]">{r.coverage}%</TableCell>
            <TableCell>
              <Badge
                className={cn(
                  "text-[10.5px] border-0",
                  r.result === "Pass" && "bg-success-soft text-success",
                  r.result === "Fail" && "bg-coral-soft text-coral",
                  r.result === "Running" && "bg-sw-soft text-sw",
                  r.result === "Pending" && "bg-secondary text-muted-foreground",
                )}
              >
                {r.result}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

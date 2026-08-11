import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatrixResult } from "@/components/docgen/MatrixResult";
import { MatrixSectionCard } from "@/components/docgen/MatrixSectionCard";
import { ResultBanner } from "@/components/docgen/ResultBanner";
import { PreviousRuns } from "@/components/docgen/PreviousRuns";
import { StatusIcon, useStickToBottom } from "@/components/docgen/progress-shared";
import { APP_NAME } from "@/lib/branding";
import {
  getDocgenJob,
  loadRun,
  startMatrix,
  type DocGenJob,
  type LiveSection,
  type MatrixSection,
} from "@/lib/api";
import { UploadCloud, FileText, Loader2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/requirements-matrix")({
  head: () => ({
    meta: [
      { title: `Requirements Matrix · Compliance & Traceability — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Turn a requirements document into a compliance & traceability matrix — every requirement kept verbatim, enriched with rationale, standards, compliance approach and risk, exported as Word and CSV.",
      },
    ],
  }),
  component: RequirementsMatrixPage,
});

const POLL_MS = 1500;

const DOC_TYPES = [
  { value: "auto", label: "Auto-detect from the file" },
  { value: "product", label: "Product / system requirements" },
  { value: "hardware", label: "Hardware requirements" },
  { value: "software", label: "Software requirements" },
  { value: "labeling", label: "Labeling requirements" },
];

function RequirementsMatrixPage() {
  const [job, setJob] = useState<DocGenJob | null>(null);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState("auto");
  const inputRef = useRef<HTMLInputElement>(null);

  const running = job?.status === "queued" || job?.status === "running";

  // Poll while the pipeline runs. Short requests only — a full matrix takes
  // longer than the 120s nginx proxy_read_timeout would allow for one call.
  useEffect(() => {
    if (!job || !running) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const next = await getDocgenJob(job.job_id);
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

  const start = useCallback(async (fn: () => Promise<DocGenJob>) => {
    setError("");
    setSubmitting(true);
    try {
      setJob(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  function onFile(file?: File | null) {
    if (file) start(() => startMatrix(file, docType));
  }

  function reset() {
    setJob(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requirements Matrix"
        subtitle="Generate the compliance & traceability matrix for a requirements document — every requirement kept verbatim"
        actions={
          job ? (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Start over
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-coral/30 bg-coral-soft/40 px-3.5 py-2.5 text-[13px]">
          <XCircle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!job && (
        <IntakeView
          dragging={dragging}
          setDragging={setDragging}
          submitting={submitting}
          inputRef={inputRef}
          onFile={onFile}
          docType={docType}
          setDocType={setDocType}
          onLoadRun={(runId) => start(() => loadRun(runId))}
        />
      )}

      {job && running && <MatrixProgress job={job} />}
      {job && !running && (
        <div className="space-y-4">
          <ResultBanner job={job} />
          <MatrixResult job={job} />
        </div>
      )}
    </div>
  );
}

// ── Intake ────────────────────────────────────────────────────────────────────
function IntakeView({
  dragging,
  setDragging,
  submitting,
  inputRef,
  onFile,
  docType,
  setDocType,
  onLoadRun,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f?: File | null) => void;
  docType: string;
  setDocType: (v: string) => void;
  onLoadRun: (runId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="text-[12.5px] text-muted-foreground">
              Upload a requirements document. Every requirement ID and its wording are kept
              verbatim; {APP_NAME} adds rationale, applicable standards, compliance approach, hazard
              and risk level.
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-muted-foreground shrink-0">Document type</span>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-8 text-[12.5px] w-[260px]">
                  {/* Render the label directly rather than relying on Radix to
                      resolve it — the items only register after hydration, so
                      a bare <SelectValue/> paints empty on first load. */}
                  <SelectValue>{DOC_TYPES.find((t) => t.value === docType)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-[12.5px]">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-col items-center justify-center text-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
                submitting && "pointer-events-none opacity-60",
              )}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {submitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="text-[15px] font-semibold">
                  {submitting ? "Reading document…" : "Drop a requirements document here"}
                </div>
                <div className="text-[12.5px] text-muted-foreground mt-0.5">
                  or click to browse · .docx or .pdf with two-column requirement tables
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".docx,.pdf,application/pdf"
                className="hidden"
                disabled={submitting}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-2.5">
            <div className="text-[13px] font-semibold">What gets exported</div>
            <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-relaxed">
              <li>
                <span className="font-medium text-foreground">Compliance matrix</span> — a landscape
                Word table of Req ID, requirement, rationale, standards, compliance approach, hazard
                and colour-coded risk level, plus CSV.
              </li>
            </ul>
          </CardContent>
        </Card>
        <PreviousRuns mode="matrix" label="Previous runs" onLoad={onLoadRun} />
      </div>
    </div>
  );
}

// ── Progress ──────────────────────────────────────────────────────────────────
function matrixPct(job: DocGenJob): number {
  const weights: Record<string, number> = { parse: 10, enrich: 70, assemble: 10, export: 10 };
  let pct = 0;
  for (const s of job.stages) {
    const w = weights[s.key] ?? 0;
    if (s.status === "done" || s.status === "failed") pct += w;
    else if (s.key === "enrich" && s.status === "running" && job.live_sections) {
      const total = job.live_sections.reduce((n, x) => n + x.total_rows, 0);
      const done = job.live_sections.reduce((n, x) => n + x.done_rows, 0);
      pct += total ? (w * done) / total : 0;
    }
  }
  return Math.round(pct);
}

const isLiveSection = (s: MatrixSection | LiveSection): s is LiveSection => "total_rows" in s;

function MatrixProgress({ job }: { job: DocGenJob }) {
  // During assemble/export live_sections is cleared but matrix is set — prefer
  // the final matrix so the handoff to the result view never reflows.
  const sections: (MatrixSection | LiveSection)[] = job.matrix?.sections ?? job.live_sections ?? [];
  const streamedRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const pct = matrixPct(job);
  useStickToBottom(streamedRows);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">Building the compliance matrix…</div>
              <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.source_name}</span>
              </div>
            </div>
            <div className="ml-auto tabular text-[12px] text-muted-foreground">{pct}%</div>
          </div>

          <Progress value={pct} className="h-1.5 mt-4" />

          <ul className="mt-5 space-y-2.5">
            {job.stages.map((s) => (
              <li key={s.key} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-0.5">
                  <StatusIcon status={s.status} />
                </span>
                <div className="min-w-0 flex-1">
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
                  {s.key === "enrich" && s.status === "running" && job.live_sections && (
                    <ul className="mt-1.5 space-y-1">
                      {job.live_sections.map((ls) => (
                        <li key={ls.title} className="flex items-center gap-2 text-[11.5px]">
                          <StatusIcon status={ls.status} small />
                          <span
                            className={cn(
                              ls.status === "pending"
                                ? "text-muted-foreground/60"
                                : "text-muted-foreground",
                            )}
                          >
                            {ls.title} · {ls.done_rows}/{ls.total_rows} rows
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-md bg-muted/50 p-3 text-[11.5px] text-muted-foreground leading-relaxed">
            Real generation — each section is a separate model call, three running in parallel, and
            the matrix below fills in as each call returns. Requirement text is never rewritten;
            only the analysis columns are generated.
          </div>
        </CardContent>
      </Card>

      {sections
        .map((s) => {
          const live = isLiveSection(s) ? s : null;
          return {
            title: s.title,
            rows: s.rows,
            running: live?.status === "running",
            totalRows: live ? live.total_rows : s.rows.length,
          };
        })
        .filter((s) => s.rows.length > 0 || s.running)
        .map((s) => (
          <MatrixSectionCard
            key={s.title}
            title={s.title}
            rows={s.rows}
            animateRows
            skeletonRows={s.running ? Math.min(3, Math.max(1, s.totalRows - s.rows.length)) : 0}
            headerNote={
              s.running ? (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> generating
                </span>
              ) : undefined
            }
          />
        ))}
    </div>
  );
}

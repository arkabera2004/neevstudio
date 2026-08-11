import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BreakdownTree } from "@/components/BreakdownTree";
import { PreviousBreakdowns } from "@/components/PreviousBreakdowns";
import { DocsetIntake } from "@/components/docgen/DocsetIntake";
import { DocsetProgress } from "@/components/docgen/DocsetProgress";
import { DocsetResult } from "@/components/docgen/DocsetResult";
import { PreviousRuns } from "@/components/docgen/PreviousRuns";
import { ResultBanner } from "@/components/docgen/ResultBanner";
import { classStyle, domainStyle } from "@/lib/breakdown-styles";
import { APP_NAME } from "@/lib/branding";
import { sampleScopeDoc, type BreakdownNode } from "@/lib/mock-data";
import {
  getDocgenJob,
  getJob,
  ingestDocument,
  ingestGeneratedDocument,
  loadBreakdownRun,
  loadRun,
  startDocset,
  type DocGenJob,
  type FileInfo,
  type GeneratedRequirement,
  type JobState,
  type Origin,
} from "@/lib/api";
import {
  UploadCloud,
  FileText,
  Download,
  Eye,
  ListChecks,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  XCircle,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/new-breakdown")({
  head: () => ({
    meta: [
      { title: `New Breakdown · Scope Intake & Document Sets — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Upload a product scope document to auto-decompose it into a classified hardware, software and labelling breakdown — or describe a concept to generate a full four-document requirement set.",
      },
    ],
  }),
  component: NewBreakdownPage,
});

const POLL_MS = 1500;

// The page hosts two pipelines behind one intake: uploading a document runs the
// breakdown pipeline; describing a concept runs document-set generation, whose
// output can then be fed back into a breakdown.
type ActiveJob = { kind: "breakdown"; job: JobState } | { kind: "docset"; job: DocGenJob };

const originStyle: Record<Origin, string> = {
  extracted: "bg-secondary text-muted-foreground",
  derived: "bg-sw-soft text-sw",
  gap: "bg-coral-soft text-coral",
};
const originLabel: Record<Origin, string> = {
  extracted: "In source",
  derived: "Derived",
  gap: "Gap found",
};

// ── Tree helpers ──────────────────────────────────────────────────────────────
function countNodes(n: BreakdownNode): number {
  return 1 + (n.children?.reduce((sum, c) => sum + countNodes(c), 0) ?? 0);
}
function maxLevel(n: BreakdownNode): number {
  return Math.max(n.level, ...(n.children?.map(maxLevel) ?? [n.level]));
}

function NewBreakdownPage() {
  const [active, setActive] = useState<ActiveJob | null>(null);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<"upload" | "concept">("upload");
  const [concept, setConcept] = useState("");
  const [productName, setProductName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const running = active?.job.status === "queued" || active?.job.status === "running";

  // Poll while the pipeline runs. Each poll is a short request, so the 120s
  // nginx proxy_read_timeout never comes into play.
  useEffect(() => {
    if (!active || !running) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const next: ActiveJob =
          active.kind === "breakdown"
            ? { kind: "breakdown", job: await getJob(active.job.job_id) }
            : { kind: "docset", job: await getDocgenJob(active.job.job_id) };
        if (!cancelled) setActive(next);
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
  }, [active, running]);

  const start = useCallback(async (fn: () => Promise<ActiveJob>) => {
    setError("");
    setSubmitting(true);
    try {
      setActive(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  function onFile(file?: File | null) {
    if (file) start(async () => ({ kind: "breakdown", job: await ingestDocument(file) }));
  }

  // One click on a generated document feeds it straight into the breakdown
  // pipeline — the backend reads the .docx off the run directory, no re-upload.
  function breakdownGenerated(file: FileInfo) {
    if (active?.kind !== "docset") return;
    const docgenJobId = active.job.job_id;
    start(async () => ({
      kind: "breakdown",
      job: await ingestGeneratedDocument(docgenJobId, file.name),
    }));
  }

  function reset() {
    setActive(null);
    setError("");
    setConcept("");
    setProductName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadSample() {
    const blob = new Blob([sampleScopeDoc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aeris-v500-scope.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Breakdown"
        subtitle="Decompose a scope document into classified hardware, software & labelling requirements — or generate the full document set from a concept"
        actions={
          active ? (
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

      {!active && (
        <IntakeView
          dragging={dragging}
          setDragging={setDragging}
          submitting={submitting}
          inputRef={inputRef}
          onFile={onFile}
          tab={tab}
          setTab={setTab}
          concept={concept}
          setConcept={setConcept}
          productName={productName}
          setProductName={setProductName}
          onGenerate={() =>
            start(async () => ({ kind: "docset", job: await startDocset(concept, productName) }))
          }
          onDownloadSample={downloadSample}
          onLoadBreakdownRun={(runId) =>
            start(async () => ({ kind: "breakdown", job: await loadBreakdownRun(runId) }))
          }
          onLoadDocsetRun={(runId) =>
            start(async () => ({ kind: "docset", job: await loadRun(runId) }))
          }
        />
      )}

      {active?.kind === "breakdown" && running && <ProgressView job={active.job} />}
      {active?.kind === "breakdown" && !running && <ResultView job={active.job} onReset={reset} />}
      {active?.kind === "docset" && running && <DocsetProgress job={active.job} />}
      {active?.kind === "docset" && !running && (
        <div className="space-y-4">
          <ResultBanner job={active.job} />
          <DocsetResult
            job={active.job}
            onBreakdown={breakdownGenerated}
            breakingDown={submitting}
          />
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
  tab,
  setTab,
  concept,
  setConcept,
  productName,
  setProductName,
  onGenerate,
  onDownloadSample,
  onLoadBreakdownRun,
  onLoadDocsetRun,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f?: File | null) => void;
  tab: "upload" | "concept";
  setTab: (v: "upload" | "concept") => void;
  concept: string;
  setConcept: (v: string) => void;
  productName: string;
  setProductName: (v: string) => void;
  onGenerate: () => void;
  onDownloadSample: () => void;
  onLoadBreakdownRun: (runId: string) => void;
  onLoadDocsetRun: (runId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card>
        <CardContent className="p-4">
          {/* Controlled so the right rail can follow the selected mode. */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "concept")}>
            <TabsList className="mb-3">
              <TabsTrigger value="upload">
                <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                Upload a document
              </TabsTrigger>
              <TabsTrigger value="concept">
                <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                Describe a concept
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
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
                  "flex flex-col items-center justify-center text-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors",
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
                    or click to browse · .docx, .pdf, .md, .txt
                  </div>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".md,.txt,.pdf,.docx,text/markdown,text/plain"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
            </TabsContent>

            <TabsContent value="concept">
              <DocsetIntake
                concept={concept}
                setConcept={setConcept}
                productName={productName}
                setProductName={setProductName}
                submitting={submitting}
                onGenerate={onGenerate}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {tab === "upload" ? (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Scope document</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              Don't have one? Start from the sample.
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onDownloadSample}
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              Download sample scope
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  Preview scope format
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Scope document format</DialogTitle>
                  <DialogDescription>
                    A structured requirements document works best — but any readable scope will do.
                  </DialogDescription>
                </DialogHeader>
                <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40 p-4 text-[12px] leading-relaxed whitespace-pre-wrap font-mono">
                  {sampleScopeDoc}
                </pre>
              </DialogContent>
            </Dialog>

            <div className="rounded-md bg-muted/50 p-3 text-[11.5px] text-muted-foreground leading-relaxed">
              <Sparkles className="h-3.5 w-3.5 inline -mt-0.5 mr-1 text-primary" />
              {APP_NAME} decomposes the scope into hardware, software and labelling requirements —
              classified CTS/CTQ, traced to a parent PRD, and carrying measurable acceptance
              criteria.
            </div>

            <PreviousBreakdowns onLoad={onLoadBreakdownRun} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2.5">
              <div className="text-[13px] font-semibold">What gets exported</div>
              <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-relaxed">
                <li>
                  <span className="font-medium text-foreground">Document set</span> — four Word
                  documents (Product, Hardware, Software, Labeling) with numbered sections and
                  traced requirement IDs, plus CSV and a ZIP bundle.
                </li>
                <li>
                  Every generated document can then be broken down into the classified requirement
                  tree with one click.
                </li>
              </ul>
            </CardContent>
          </Card>
          <PreviousRuns mode="docset" label="Previous document sets" onLoad={onLoadDocsetRun} />
        </div>
      )}
    </div>
  );
}

// ── Progress ──────────────────────────────────────────────────────────────────
function ProgressView({ job }: { job: JobState }) {
  const done = job.stages.filter((s) => s.status === "done").length;
  const pct = Math.round((done / job.stages.length) * 100);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">
              {job.source_kind === "document" ? "Analyzing document…" : "Generating requirements…"}
            </div>
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
          Real generation — this typically takes 60–90 seconds. Each stage is a separate model call;
          the three domains decompose in parallel.
        </div>
      </CardContent>
    </Card>
  );
}

// ── Result ────────────────────────────────────────────────────────────────────
function ResultView({ job, onReset }: { job: JobState; onReset: () => void }) {
  const root = job.tree;
  const [selected, setSelected] = useState<BreakdownNode | null>(root);

  if (job.status === "failed" || !root) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-coral/30 bg-coral-soft/40 px-3.5 py-2.5 text-[13px]">
          <XCircle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Generation failed</div>
            <div className="text-muted-foreground mt-0.5">
              {job.error ?? "The pipeline produced no breakdown."}
            </div>
          </div>
        </div>
        <StageRecap job={job} />
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Try again
        </Button>
      </div>
    );
  }

  const gaps = job.requirements.filter((r) => r.origin === "gap");
  const cts = job.requirements.filter((r) => r.classification === "CTS");
  const byDomain = (d: string) => root.children?.find((c) => c.domain === d)?.reqs ?? 0;

  const stats = [
    { l: "Total requirements", v: String(root.reqs) },
    { l: "HW / SW / LBL", v: `${byDomain("HW")} / ${byDomain("SW")} / ${byDomain("LBL")}` },
    { l: "Critical-to-safety", v: String(cts.length) },
    { l: "Gaps identified", v: String(gaps.length) },
    { l: "Deepest branch", v: `L${maxLevel(root)}` },
    { l: "Nodes", v: String(countNodes(root)) },
  ];

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px]",
          job.status === "partial"
            ? "border-amber-brand/30 bg-amber-soft/40"
            : "border-success/30 bg-success-soft/40",
        )}
      >
        {job.status === "partial" ? (
          <AlertTriangle className="h-4 w-4 text-amber-brand shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div>
            <span className="font-medium">{job.product}</span> — {root.reqs} requirements from{" "}
            <span className="font-medium">{job.source_name}</span>
            {job.duration_ms != null && (
              <span className="text-muted-foreground">
                {" "}
                · {(job.duration_ms / 1000).toFixed(1)}s
              </span>
            )}
            {job.status === "partial" && (
              <span className="text-muted-foreground"> · some stages failed</span>
            )}
          </div>
          {job.summary && <div className="text-muted-foreground mt-1">{job.summary}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.l}>
            <CardContent className="p-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {s.l}
              </div>
              <div className="tabular text-2xl font-semibold mt-1">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tree">
        <TabsList>
          <TabsTrigger value="tree">Decomposition tree</TabsTrigger>
          <TabsTrigger value="reqs">Requirements ({job.requirements.length})</TabsTrigger>
          <TabsTrigger value="gaps">Gaps ({gaps.length})</TabsTrigger>
          <TabsTrigger value="system">System PRDs ({job.system_requirements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Generated decomposition</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  System → domain → module → element → unit · click a node for detail
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[560px] overflow-y-auto pr-2">
                  <BreakdownTree
                    root={root}
                    onSelect={setSelected}
                    selectedId={selected?.id ?? ""}
                  />
                </div>
              </CardContent>
            </Card>
            <NodeDetail node={selected} requirements={job.requirements} />
          </div>
        </TabsContent>

        <TabsContent value="reqs" className="mt-3">
          <RequirementTable rows={job.requirements} />
        </TabsContent>

        <TabsContent value="gaps" className="mt-3">
          {gaps.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-[13px] text-muted-foreground">
                No gaps identified against the source.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md bg-coral-soft/40 border border-coral/30 p-3 text-[12px] leading-relaxed">
                <AlertTriangle className="h-3.5 w-3.5 inline -mt-0.5 mr-1 text-coral" />
                Requirements a standard or good practice calls for that the source document doesn't
                cover.
              </div>
              <RequirementTable rows={gaps} showGapNote />
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead className="w-[110px]">Origin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.system_requirements.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular text-[12px] text-muted-foreground">
                        {r.id}
                      </TableCell>
                      <TableCell className="text-[13px]">{r.statement}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("h-5 text-[10px] border-0", originStyle[r.origin])}
                        >
                          {originLabel[r.origin]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StageRecap job={job} />

      <div className="flex flex-wrap items-center gap-2">
        {/* Persisted run id == job id (db.save_run uses job_id), so one param
            serves both the Postgres and in-memory lookup paths. */}
        <Button asChild size="sm">
          <Link to="/classification" search={{ breakdown: job.job_id }}>
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
            Classify this breakdown
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/breakdown">
            Open in Product Breakdown
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Start over
        </Button>
      </div>
    </div>
  );
}

function NodeDetail({
  node,
  requirements,
}: {
  node: BreakdownNode | null;
  requirements: GeneratedRequirement[];
}) {
  const req = node ? requirements.find((r) => r.id === node.id) : undefined;

  return (
    <Card className="h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{node ? node.id : "Select a node"}</CardTitle>
        {node && <div className="text-[11px] text-muted-foreground">Level {node.level}</div>}
      </CardHeader>
      <CardContent className="space-y-3 text-[12.5px]">
        {!node && <div className="text-muted-foreground">Click any node in the tree.</div>}
        {node && !req && (
          <div className="text-muted-foreground">
            {node.name} — {node.reqs} requirement{node.reqs === 1 ? "" : "s"} below this node.
          </div>
        )}
        {req && (
          <>
            <div>{req.statement}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className={cn("h-5 text-[10px] border-0", domainStyle[req.domain])}
              >
                {req.domain}
              </Badge>
              <Badge
                variant="outline"
                className={cn("h-5 text-[10px] border-0", classStyle[req.classification])}
              >
                {req.classification}
              </Badge>
              <Badge
                variant="outline"
                className={cn("h-5 text-[10px] border-0", originStyle[req.origin])}
              >
                {originLabel[req.origin]}
              </Badge>
            </div>
            <Field label="Module" value={req.module} />
            <Field label="Parent PRD" value={req.parent_id} />
            <Field label="Rationale" value={req.rationale} />
            <Field label="Standard" value={req.standard} />
            <Field label="Risk link" value={req.risk_link} />
            <Field label="Acceptance criteria" value={req.acceptance_criteria} />
            <Field
              label="Verification"
              value={
                req.verification_method
                  ? `${req.verification_method}${req.verification_id ? ` · ${req.verification_id}` : ""}`
                  : null
              }
            />
            <Field label="Gap note" value={req.gap_note} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function RequirementTable({
  rows,
  showGapNote = false,
}: {
  rows: GeneratedRequirement[];
  showGapNote?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">ID</TableHead>
                <TableHead className="min-w-[280px]">Requirement</TableHead>
                <TableHead className="w-[70px]">Domain</TableHead>
                <TableHead className="w-[150px]">Module</TableHead>
                <TableHead className="w-[90px]">Parent</TableHead>
                <TableHead className="w-[80px]">Class</TableHead>
                <TableHead className="w-[100px]">Origin</TableHead>
                <TableHead className="min-w-[220px]">
                  {showGapNote ? "Why it was missing" : "Acceptance criteria"}
                </TableHead>
                <TableHead className="w-[150px]">Standard</TableHead>
                <TableHead className="w-[120px]">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular text-[11.5px] text-muted-foreground align-top">
                    {r.id}
                  </TableCell>
                  <TableCell className="text-[12.5px] align-top">{r.statement}</TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px] border-0", domainStyle[r.domain])}
                    >
                      {r.domain}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground align-top">
                    {r.module}
                  </TableCell>
                  <TableCell className="tabular text-[11.5px] text-muted-foreground align-top">
                    {r.parent_id ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px] border-0", classStyle[r.classification])}
                    >
                      {r.classification}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px] border-0", originStyle[r.origin])}
                    >
                      {originLabel[r.origin]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11.5px] align-top">
                    {(showGapNote ? r.gap_note : r.acceptance_criteria) ?? "—"}
                  </TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground align-top">
                    {r.standard ?? "—"}
                  </TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground align-top">
                    {r.verification_method ? (
                      <>
                        {r.verification_method}
                        {r.verification_id && (
                          <div className="tabular text-[10.5px] opacity-70">
                            {r.verification_id}
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function StageRecap({ job }: { job: JobState }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
        <div className="text-[11px] text-muted-foreground">
          {job.model ? `AI model · ${job.stages.length} stages` : `${job.stages.length} stages`}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {job.stages.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5 text-[12.5px]">
              {s.status === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
              ) : s.status === "failed" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-coral shrink-0 mt-0.5" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span>{s.label}</span>
                {s.detail && (
                  <span
                    className={cn(
                      "ml-1.5 text-[11.5px]",
                      s.status === "failed" ? "text-coral" : "text-muted-foreground",
                    )}
                  >
                    — {s.detail}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AgentResult } from "@/components/AgentResult";
import { agents, type AgentDef } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import {
  getAgentRun,
  listAgentRuns,
  runAgent,
  type AgentRunSummary,
  type RunResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { PlayCircle, Sliders, Loader2, AlertTriangle, Clock, Cpu, History } from "lucide-react";

export const Route = createFileRoute("/_app/capabilities")({
  head: () => ({
    meta: [
      { title: `AI Capability Map — ${APP_NAME}` },
      { name: "description", content: "Every agent, its status, config, and run history." },
    ],
  }),
  component: CapabilitiesPage,
});

const statusStyle = {
  Ready: "bg-success-soft text-success",
  Beta: "bg-amber-soft text-amber-brand",
  Planned: "bg-secondary text-muted-foreground",
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CapabilitiesPage() {
  const groups: ("Requirements" | "Verification" | "Hardware")[] = [
    "Requirements",
    "Verification",
    "Hardware",
  ];
  const ready = agents.filter((a) => a.status === "Ready").length;
  const beta = agents.filter((a) => a.status === "Beta").length;
  const planned = agents.filter((a) => a.status === "Planned").length;

  const [active, setActive] = useState<AgentDef | null>(null);
  const [viewRunId, setViewRunId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Persisted run history (Postgres-backed; empty when the DB isn't configured,
  // in which case the page renders exactly as it did before persistence).
  const history = useQuery({ queryKey: ["agent-runs"], queryFn: listAgentRuns, retry: false });
  const runsByAgent = useMemo(() => {
    const grouped: Record<string, AgentRunSummary[]> = {};
    for (const r of history.data ?? []) (grouped[r.agent_id] ??= []).push(r); // already newest-first
    return grouped;
  }, [history.data]);

  const run = useMutation<RunResponse, Error, AgentDef>({
    mutationFn: (agent) => runAgent(agent.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-runs"] }),
  });

  // A past run being viewed in the dialog. Live mutation state always wins.
  const viewed = useQuery({
    queryKey: ["agent-run", viewRunId],
    queryFn: () => getAgentRun(viewRunId!),
    enabled: viewRunId !== null,
    retry: false,
  });

  function handleRun(agent: AgentDef) {
    setActive(agent);
    setViewRunId(null);
    run.reset();
    run.mutate(agent);
  }

  function handleView(agent: AgentDef, runId: string) {
    setActive(agent);
    run.reset();
    setViewRunId(runId);
  }

  function closeDialog() {
    setActive(null);
    setViewRunId(null);
  }

  const showLive = run.isPending || run.isError || run.isSuccess;
  const activeHistory = active ? (runsByAgent[active.id] ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Capability Map"
        subtitle={`${ready} Ready · ${beta} Beta · ${planned} Planned — Beta agents always route through approval`}
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Ready", v: ready, tone: "success" },
          { l: "Beta", v: beta, tone: "amber" },
          { l: "Planned", v: planned, tone: "muted" },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="p-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {s.l}
              </div>
              <div
                className={cn(
                  "tabular text-3xl font-semibold mt-1",
                  s.tone === "success" && "text-success",
                  s.tone === "amber" && "text-amber-brand",
                )}
              >
                {s.v}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {g}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents
              .filter((a) => a.group === g)
              .map((a) => {
                const isRunning = run.isPending && active?.id === a.id;
                const agentRuns = runsByAgent[a.id] ?? [];
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-[13.5px] font-semibold">{a.name}</CardTitle>
                        <Badge className={cn("text-[10.5px] border-0", statusStyle[a.status])}>
                          {a.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-[12.5px] text-muted-foreground">{a.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular min-h-6">
                        {agentRuns.length > 0 ? (
                          <>
                            <div>
                              {agentRuns.length} run{agentRuns.length === 1 ? "" : "s"} · last{" "}
                              {timeAgo(agentRuns[0].created_at)}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => handleView(a, agentRuns[0].run_id)}
                            >
                              <History className="h-3 w-3 mr-1" />
                              Last result
                            </Button>
                          </>
                        ) : (
                          <>
                            <div>{a.runs} runs</div>
                            <div>{a.successRate}% success</div>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8"
                          disabled={a.status === "Planned" || isRunning}
                          onClick={() => handleRun(a)}
                        >
                          {isRunning ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {isRunning ? "Running…" : "Run now"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8">
                          <Sliders className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}

      <Dialog open={active !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {active?.name}
              {active && (
                <Badge className={cn("text-[10.5px] border-0", statusStyle[active.status])}>
                  {active.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto pr-1">
            {run.isPending && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <div className="text-[13px] text-muted-foreground">
                  Running agent — calling the model…
                </div>
              </div>
            )}

            {run.isError && (
              <div className="flex items-start gap-3 rounded-md border border-coral/30 bg-coral-soft/40 p-4">
                <AlertTriangle className="h-4 w-4 text-coral mt-0.5 shrink-0" />
                <div className="text-[12.5px]">
                  <div className="font-medium text-coral">Run failed</div>
                  <div className="mt-1 text-foreground/80">{run.error.message}</div>
                </div>
              </div>
            )}

            {run.isSuccess && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tabular border-b border-border pb-3">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5" />
                    AI model
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {(run.data.duration_ms / 1000).toFixed(1)}s
                  </span>
                  <span>scope: {run.data.scope}</span>
                </div>
                <AgentResult data={run.data.result} />
              </div>
            )}

            {!showLive && viewRunId !== null && viewed.isPending && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <div className="text-[13px] text-muted-foreground">Loading saved run…</div>
              </div>
            )}

            {!showLive && viewed.isError && (
              <div className="flex items-start gap-3 rounded-md border border-coral/30 bg-coral-soft/40 p-4">
                <AlertTriangle className="h-4 w-4 text-coral mt-0.5 shrink-0" />
                <div className="text-[12.5px]">
                  <div className="font-medium text-coral">Couldn't load the saved run</div>
                  <div className="mt-1 text-foreground/80">{viewed.error.message}</div>
                </div>
              </div>
            )}

            {!showLive && viewed.isSuccess && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tabular border-b border-border pb-3">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5" />
                    AI model
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {(viewed.data.duration_ms / 1000).toFixed(1)}s
                  </span>
                  <span>scope: {viewed.data.scope}</span>
                  <span className="flex items-center gap-1">
                    <History className="h-3.5 w-3.5" />
                    from {new Date(viewed.data.created_at).toLocaleString()}
                  </span>
                </div>
                <AgentResult data={viewed.data.result} />
              </div>
            )}

            {active && activeHistory.length > 0 && !run.isPending && (
              <div className="mt-5 border-t border-border pt-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Run history
                </div>
                <div className="space-y-0.5">
                  {activeHistory.map((r) => (
                    <button
                      key={r.run_id}
                      onClick={() => handleView(active, r.run_id)}
                      className={cn(
                        "w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors",
                        !showLive && r.run_id === viewRunId && "bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground tabular">
                        <span className="text-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        {r.duration_ms != null && <span>{(r.duration_ms / 1000).toFixed(1)}s</span>}
                        <span className="truncate">{r.scope}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

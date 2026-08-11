import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/branding";
import { PageHeader } from "@/components/PageHeader";
import { WaveformHero } from "@/components/WaveformHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  agentActivity,
  coverageTrend,
  complianceReadiness,
  workflowStages,
  programs,
  approvals,
} from "@/lib/mock-data";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ArrowUpRight, AlertTriangle, CheckCircle2, Bot, User } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: `Overview · Aeris V500 — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Live program-wide view: requirements, standards, verification coverage, BOM savings, agent activity.",
      },
    ],
  }),
  component: Overview,
});

const p = programs[0];

function KpiCard({
  label,
  value,
  delta,
  tone,
  to,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "teal" | "coral" | "amber" | "success";
  to: string;
}) {
  const toneMap = {
    teal: "text-teal border-teal/30 bg-teal-soft/40",
    coral: "text-coral border-coral/30 bg-coral-soft/40",
    amber: "text-amber-brand border-amber-brand/30 bg-amber-soft/40",
    success: "text-success border-success/30 bg-success-soft/40",
  } as const;
  return (
    <Link to={to} className="block">
      <Card className="hover:shadow-elevated transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <div className="tabular text-3xl font-semibold">{value}</div>
            {delta && (
              <span
                className={
                  "tabular rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium " +
                  (tone ? toneMap[tone] : "text-muted-foreground border-border")
                }
              >
                {delta}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Overview() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Overview"
        subtitle={`${p.name} · ${p.subtitle} · Stage: ${p.stage}`}
        actions={
          <>
            <Button variant="outline" size="sm">
              Snapshot
            </Button>
            <Button size="sm">Generate DHF</Button>
          </>
        }
      />

      {/* Hero */}
      <div className="relative min-h-[340px] sm:min-h-[300px] md:min-h-[220px]">
        <WaveformHero className="absolute inset-0" />
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-widest text-ink-foreground/60">
              Live program telemetry
            </div>
            <div className="mt-1 text-ink-foreground text-xl font-semibold">
              Aeris V500 · Verification phase
            </div>
            <div className="mt-0.5 text-ink-foreground/70 text-[13px]">
              Waveform reflects live agent + human activity across the traceability spine
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: "Requirements decomposed", v: "428", d: "+12 this week" },
              { l: "Standards mapped", v: "10", d: "1 gap" },
              { l: "Verification coverage", v: "87%", d: "+3.4pt" },
              { l: "BOM saving / unit", v: "$218", d: "of $246 target" },
            ].map((s) => (
              <div key={s.l} className="border-l border-ink-foreground/15 pl-3">
                <div className="text-[10.5px] uppercase tracking-wider text-ink-foreground/60">
                  {s.l}
                </div>
                <div className="tabular text-2xl font-semibold text-ink-foreground mt-0.5">
                  {s.v}
                </div>
                <div className="text-[11px] text-ink-foreground/60 tabular">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total requirements"
          value="428"
          delta="236 SW · 192 HW"
          to="/classification"
        />
        <KpiCard
          label="Critical-to-Safety"
          value="112"
          delta="94% verified"
          tone="success"
          to="/classification"
        />
        <KpiCard
          label="Test coverage"
          value="87%"
          delta="1,284 cases"
          tone="teal"
          to="/verification"
        />
        <KpiCard
          label="BOM saving / unit"
          value="$218"
          delta="12.4% of BOM"
          tone="amber"
          to="/hardware"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Verification coverage trend</CardTitle>
            <div className="text-[11px] text-muted-foreground">By test level · nightly rollup</div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={coverageTrend}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="unit"
                    name="Unit"
                    stroke="var(--color-teal)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="integ"
                    name="Integration"
                    stroke="var(--color-sw)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="system"
                    name="System"
                    stroke="var(--color-hw)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Compliance readiness</CardTitle>
            <div className="text-[11px] text-muted-foreground">Weighted alignment · monthly</div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={complianceReadiness}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="areaComp" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="weighted"
                    stroke="var(--color-teal)"
                    strokeWidth={2}
                    fill="url(#areaComp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Program workflow</CardTitle>
          <div className="text-[11px] text-muted-foreground">
            Live pipeline status · entities in stage / total
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {workflowStages.map((s) => (
              <div key={s.name} className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.name}
                </div>
                <div className="tabular text-xl font-semibold mt-1">{s.pct}%</div>
                <Progress value={s.pct} className="h-1.5 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity + Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Agent activity</CardTitle>
              <div className="text-[11px] text-muted-foreground">
                Live · from audit + agent runs
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> streaming
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border">
              {agentActivity.map((e) => {
                const Icon = e.actor === "agent" ? Bot : User;
                const dot =
                  e.severity === "critical"
                    ? "bg-coral"
                    : e.severity === "warn"
                      ? "bg-amber-brand"
                      : e.severity === "success"
                        ? "bg-success"
                        : "bg-teal";
                return (
                  <li key={e.id} className="py-3 flex gap-3">
                    <div className={"mt-1 h-2 w-2 rounded-full shrink-0 " + dot} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{e.actorName}</span>
                        <span className="ml-auto tabular text-[10.5px] text-muted-foreground">
                          {e.time}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-foreground/90">{e.message}</div>
                      {e.entity && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="tabular text-[10.5px]">
                            {e.entity}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Your approvals</CardTitle>
              <div className="text-[11px] text-muted-foreground">Items awaiting sign-off</div>
            </div>
            <Link to="/approvals" className="text-[11.5px] text-primary hover:underline">
              Open queue
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-3">
              {approvals.slice(0, 4).map((a) => (
                <li key={a.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start gap-2">
                    {a.priority === "High" ? (
                      <AlertTriangle className="h-4 w-4 text-coral mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-amber-brand mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium">{a.kind}</div>
                      <div className="tabular text-[11px] text-muted-foreground mt-0.5">
                        {a.entity}
                      </div>
                      <div className="text-[12px] text-foreground/80 mt-1.5 line-clamp-2">
                        {a.proposal}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

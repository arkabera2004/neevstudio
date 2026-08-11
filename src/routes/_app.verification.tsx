import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Progress } from "@/components/ui/progress";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/branding";

export const Route = createFileRoute("/_app/verification")({
  head: () => ({
    meta: [
      { title: `Verification (V-Model) — ${APP_NAME}` },
      {
        name: "description",
        content: "V-model traceability, test generation, coverage and execution results.",
      },
    ],
  }),
  component: VerificationPage,
});

const donut = [
  { name: "Passed", value: 1088, color: "var(--color-success)" },
  { name: "Failed", value: 21, color: "var(--color-coral)" },
  { name: "Running", value: 43, color: "var(--color-sw)" },
  { name: "Pending", value: 132, color: "var(--color-muted-foreground)" },
];

const vModel = [
  { def: "User Needs", ver: "Clinical Validation", cases: 42, pass: 38, fail: 0, run: 4 },
  {
    def: "System Requirements",
    ver: "System Verification",
    cases: 218,
    pass: 190,
    fail: 3,
    run: 25,
  },
  { def: "Subsystem Design", ver: "Integration Test", cases: 486, pass: 431, fail: 7, run: 48 },
  { def: "Detailed Design", ver: "Unit Test", cases: 538, pass: 471, fail: 11, run: 56 },
];

const executions = [
  {
    id: "TC-08840",
    req: "REQ-1058",
    name: "Apnea backup ventilation start ≤4.0s",
    level: "System",
    result: "Fail",
    when: "34 min ago",
    by: "Verification Runner",
  },
  {
    id: "TC-08834",
    req: "REQ-1042",
    name: "Blower pressure step response ±2 cmH2O",
    level: "Integration",
    result: "Pass",
    when: "58 min ago",
    by: "CI rig",
  },
  {
    id: "TC-08821",
    req: "REQ-3140",
    name: "PEEP stability across cycles",
    level: "System",
    result: "Running",
    when: "12 min ago",
    by: "CI rig",
  },
  {
    id: "TC-08810",
    req: "REQ-2145",
    name: "Trigger response ≤100 ms",
    level: "Integration",
    result: "Pass",
    when: "2 h ago",
    by: "CI rig",
  },
  {
    id: "TC-08801",
    req: "REQ-4020",
    name: "Humidifier reaches 37°C in 15 min",
    level: "System",
    result: "Pass",
    when: "3 h ago",
    by: "M. Chen",
  },
];

function VerificationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification (V-Model)"
        subtitle="1,284 test cases · 87% coverage · live rollup from CI rig + manual entries"
        actions={
          <Button size="sm">
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
            Generate test cases
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Overall coverage</CardTitle>
            <div className="text-[11px] text-muted-foreground">All test cases · live</div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none top-[10px]">
                <div className="tabular text-3xl font-semibold">87%</div>
                <div className="text-[11px] text-muted-foreground">1,284 cases</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">V-model traceability</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              Each definition level paired with its verification activity
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Definition</TableHead>
                  <TableHead>Verification activity</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right text-success">Pass</TableHead>
                  <TableHead className="text-right text-coral">Fail</TableHead>
                  <TableHead className="text-right text-sw">Running</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vModel.map((r) => (
                  <TableRow key={r.def}>
                    <TableCell className="font-medium">{r.def}</TableCell>
                    <TableCell>{r.ver}</TableCell>
                    <TableCell className="text-right tabular">{r.cases}</TableCell>
                    <TableCell className="text-right tabular">{r.pass}</TableCell>
                    <TableCell className="text-right tabular">{r.fail}</TableCell>
                    <TableCell className="text-right tabular">{r.run}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { l: "SRS generated", v: 82, of: 96, tone: "text-teal" },
          { l: "SRS reviewed", v: 71, of: 96, tone: "text-amber-brand" },
          { l: "SRS approved", v: 62, of: 96, tone: "text-success" },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.l}
                </div>
                <div className="tabular text-[11px] text-muted-foreground">
                  {s.v}/{s.of}
                </div>
              </div>
              <div className={cn("tabular text-3xl font-semibold mt-1", s.tone)}>
                {Math.round((s.v / s.of) * 100)}%
              </div>
              <Progress value={(s.v / s.of) * 100} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent test executions</CardTitle>
          <div className="text-[11px] text-muted-foreground">
            Results from CI rig via ALM integration + manual entries
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test case</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>When</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular font-medium">{e.id}</TableCell>
                  <TableCell className="tabular">{e.req}</TableCell>
                  <TableCell className="text-[12.5px]">{e.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10.5px]">
                      {e.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0",
                        e.result === "Pass" && "bg-success-soft text-success",
                        e.result === "Fail" && "bg-coral-soft text-coral",
                        e.result === "Running" && "bg-sw-soft text-sw",
                      )}
                    >
                      {e.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular text-[12px] text-muted-foreground">
                    {e.when}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{e.by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

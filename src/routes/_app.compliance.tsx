import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBoundaryRule,
  listBoundaryRules,
  type BoundaryRule,
  type BoundaryRuleInput,
} from "@/lib/api";
import { standards, boundaryConditions, radarCoverage } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/compliance")({
  head: () => ({
    meta: [
      { title: `Compliance & Standards — ${APP_NAME}` },
      { name: "description", content: "Standards mapping, coverage, and boundary conditions." },
    ],
  }),
  component: CompliancePage,
});

function CoverageBar({ v }: { v: number }) {
  const tone = v >= 90 ? "bg-success" : v >= 82 ? "bg-amber-brand" : "bg-coral";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full", tone)} style={{ width: v + "%" }} />
      </div>
      <span className="tabular text-[12px] w-9">{v}%</span>
    </div>
  );
}

const emptyRuleForm = {
  parameter: "",
  threshold: "",
  drives: "CTS" as BoundaryRule["drives"],
  reqs: "",
  source: "",
};

function CompliancePage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyRuleForm);

  const rulesQuery = useQuery({
    queryKey: ["boundary-rules"],
    queryFn: listBoundaryRules,
    retry: false,
  });
  const savedRules = rulesQuery.data ?? [];
  const allRules = [...boundaryConditions, ...savedRules];

  const createRule = useMutation<BoundaryRule, Error, BoundaryRuleInput>({
    mutationFn: createBoundaryRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boundary-rules"] });
      closeDialog();
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyRuleForm);
    createRule.reset();
  };

  const canSubmit =
    !createRule.isPending &&
    form.parameter.trim() !== "" &&
    form.threshold.trim() !== "" &&
    form.source.trim() !== "";

  const submitRule = () => {
    if (!canSubmit) return;
    createRule.mutate({
      parameter: form.parameter.trim(),
      threshold: form.threshold.trim(),
      drives: form.drives,
      reqs: Math.max(0, Number(form.reqs) || 0),
      source: form.source.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & Standards"
        subtitle={`10 standards mapped · ${allRules.length} active boundary conditions`}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add standard
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mapped standards</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Standard</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead className="text-right">Requirements</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standards.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium tabular">{s.id}</TableCell>
                    <TableCell>{s.body}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10.5px]">
                        {s.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CoverageBar v={s.coverage} />
                    </TableCell>
                    <TableCell className="text-right tabular">{s.reqs}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10.5px] border-0",
                          s.status === "Aligned" && "bg-success-soft text-success",
                          s.status === "Partial" && "bg-amber-soft text-amber-brand",
                          s.status === "Gap" && "bg-coral-soft text-coral",
                        )}
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Coverage by category</CardTitle>
            <div className="text-[11px] text-muted-foreground">Current vs target readiness</div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarCoverage}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="area"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                  />
                  <Radar
                    name="Target"
                    dataKey="target"
                    stroke="var(--color-hw)"
                    fill="var(--color-hw)"
                    fillOpacity={0.15}
                  />
                  <Radar
                    name="Current"
                    dataKey="current"
                    stroke="var(--color-teal)"
                    fill="var(--color-teal)"
                    fillOpacity={0.35}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Derived boundary conditions</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              Versioned · Compliance Lead approval required before applying to live requirements
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New rule
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Drives</TableHead>
                <TableHead className="text-right">Linked reqs</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRules.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="tabular font-medium">{b.id}</TableCell>
                  <TableCell>{b.parameter}</TableCell>
                  <TableCell className="tabular">{b.threshold}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0",
                        b.drives === "CTS"
                          ? "bg-coral-soft text-coral"
                          : "bg-amber-soft text-amber-brand",
                      )}
                    >
                      {b.drives}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular">{b.reqs}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{b.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Competitor benchmarking</CardTitle>
          <div className="text-[11px] text-muted-foreground">
            Parameter-by-parameter vs named competitors and regulatory floor
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Aeris V500</TableHead>
                <TableHead>Hamilton C6</TableHead>
                <TableHead>Dräger Evita</TableHead>
                <TableHead>Reg. floor</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { p: "Tidal volume accuracy", a: "±4%", h: "±5%", d: "±4%", r: "±10%", v: "Leads" },
                {
                  p: "Apnea backup start",
                  a: "≤4.0s",
                  h: "≤4.5s",
                  d: "≤5.0s",
                  r: "≤5.0s",
                  v: "Leads",
                },
                {
                  p: "Battery runtime",
                  a: "45 min",
                  h: "60 min",
                  d: "45 min",
                  r: "30 min",
                  v: "On par",
                },
                {
                  p: "Trigger latency",
                  a: "≤100 ms",
                  h: "≤90 ms",
                  d: "≤120 ms",
                  r: "≤200 ms",
                  v: "Behind",
                },
              ].map((row) => (
                <TableRow key={row.p}>
                  <TableCell>{row.p}</TableCell>
                  <TableCell className="tabular font-medium">{row.a}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{row.h}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{row.d}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{row.r}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0",
                        row.v === "Leads" && "bg-success-soft text-success",
                        row.v === "On par" && "bg-secondary text-muted-foreground",
                        row.v === "Behind" && "bg-coral-soft text-coral",
                      )}
                    >
                      {row.v}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New boundary condition</DialogTitle>
            <DialogDescription>
              Saved to the program database and appended after the derived set with the next BC id.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-parameter">Parameter</Label>
              <Input
                id="rule-parameter"
                placeholder="e.g. Trigger latency"
                value={form.parameter}
                onChange={(e) => setForm({ ...form, parameter: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-threshold">Threshold</Label>
                <Input
                  id="rule-threshold"
                  placeholder="e.g. ≤ 100 ms"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Drives</Label>
                <Select
                  value={form.drives}
                  onValueChange={(v) => setForm({ ...form, drives: v as BoundaryRule["drives"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CTS">CTS</SelectItem>
                    <SelectItem value="CTQ">CTQ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-source">Source</Label>
              <Input
                id="rule-source"
                placeholder="e.g. ISO 80601-2-12 §201.12.4.101"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-reqs">Linked requirements</Label>
              <Input
                id="rule-reqs"
                type="number"
                min={0}
                placeholder="0"
                value={form.reqs}
                onChange={(e) => setForm({ ...form, reqs: e.target.value })}
              />
            </div>
            {createRule.isError && (
              <div className="text-[12.5px] text-coral">{createRule.error.message}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitRule} disabled={!canSubmit}>
              {createRule.isPending ? "Saving…" : "Save rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { bom, costBySubsystem } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { Upload, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/hardware")({
  head: () => ({
    meta: [
      { title: `Hardware & BOM — ${APP_NAME}` },
      {
        name: "description",
        content: "Bill of materials, alternate vendors, price optimization, and ERP push.",
      },
    ],
  }),
  component: HardwarePage,
});

const chartColors = [
  "var(--color-teal)",
  "var(--color-sw)",
  "var(--color-hw)",
  "var(--color-amber-brand)",
  "var(--color-coral)",
  "var(--color-success)",
];

const price = [
  { part: "Blower motor", list: 218, opt: 184 },
  { part: "Inspiratory valve", list: 108, opt: 96 },
  { part: "Flow sensor", list: 92, opt: 78 },
  { part: "O2 sensor", list: 41, opt: 34 },
  { part: "Battery pack", list: 168, opt: 142 },
  { part: "Display", list: 68, opt: 58 },
];

const risks = [
  {
    part: "MCU STM32H7",
    risk: "20-week lead time; single source",
    mitigation: "Add NXP i.MX RT as second source (qualification Q3)",
    severity: "High",
  },
  {
    part: "Inspiratory valve",
    risk: "Sole-source proportional valve, pressure runaway on failure",
    mitigation: "Approve Parker Hannifin PVS-25 alternate — CTS re-qualification required",
    severity: "High",
  },
  {
    part: "O2 sensor",
    risk: "Ambient temperature drift outside spec at −5°C",
    mitigation: "Move to Sensirion SFA30 with active compensation",
    severity: "Medium",
  },
  {
    part: "Battery pack",
    risk: "Cell supplier factory relocation Q4",
    mitigation: "Dual-source cell supply, extend contract Panasonic 6 months",
    severity: "Medium",
  },
];

const contracts = [
  { vendor: "Nidec Copal", status: "Active", renewal: "2027-02-15", spend: 412000 },
  { vendor: "IMI Norgren", status: "Renegotiating", renewal: "2026-09-12", spend: 268000 },
  { vendor: "Sensirion", status: "Active", renewal: "2027-05-01", spend: 194000 },
  { vendor: "Fisher & Paykel", status: "Expiring", renewal: "2026-08-04", spend: 356000 },
  { vendor: "Mean Well", status: "Active", renewal: "2027-11-22", spend: 82000 },
];

function HardwarePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware & BOM"
        subtitle="342 parts · $1,776 unit cost optimized · $218 saving / unit (12.4%)"
        actions={
          <Button size="sm">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Push BOM to ERP/PLM
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "BOM parts", v: "342", d: "24 CTS-tagged" },
          { l: "Unit cost", v: "$1,776", d: "list $1,994" },
          { l: "Saving / unit", v: "$218", d: "12.4%" },
          { l: "Supply-chain risk", v: "2 High", d: "3 Medium · 8 Low", tone: "coral" as const },
        ].map((s) => (
          <Card key={s.l}>
            <CardContent className="p-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {s.l}
              </div>
              <div
                className={cn(
                  "tabular text-2xl font-semibold mt-1",
                  s.tone === "coral" && "text-coral",
                )}
              >
                {s.v}
              </div>
              <div className="text-[11px] text-muted-foreground tabular mt-0.5">{s.d}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Cost by subsystem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBySubsystem}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {costBySubsystem.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Price optimization levers</CardTitle>
            <div className="text-[11px] text-muted-foreground">List vs optimized unit cost</div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={price} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="part"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    interval={0}
                    angle={-15}
                    height={50}
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
                  <Bar dataKey="list" fill="var(--color-hw)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opt" fill="var(--color-teal)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Bill of materials · critical parts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Failure effect</TableHead>
                <TableHead className="text-right">Saving</TableHead>
                <TableHead>Alt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="tabular font-medium">
                    {b.id}
                    {b.cts && (
                      <Badge className="ml-2 text-[9.5px] px-1 border-0 bg-coral-soft text-coral">
                        CTS
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{b.part}</TableCell>
                  <TableCell className="text-[12.5px]">{b.vendor}</TableCell>
                  <TableCell className="tabular text-right">${b.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="tabular text-[12px]">{b.leadTime}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0",
                        b.risk === "High" && "bg-coral-soft text-coral",
                        b.risk === "Medium" && "bg-amber-soft text-amber-brand",
                        b.risk === "Low" && "bg-success-soft text-success",
                      )}
                    >
                      {b.risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {b.failureEffect}
                  </TableCell>
                  <TableCell className="tabular text-right text-success">
                    ${b.saving.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular text-[12px]">{b.alternates}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-coral" />
            <CardTitle className="text-sm font-semibold">Supply-chain risk & mitigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {risks.map((r) => (
                <div key={r.part} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium">{r.part}</div>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0",
                        r.severity === "High"
                          ? "bg-coral-soft text-coral"
                          : "bg-amber-soft text-amber-brand",
                      )}
                    >
                      {r.severity}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{r.risk}</div>
                  <div className="mt-1.5 text-[12px]">
                    <span className="text-muted-foreground">Mitigation:</span> {r.mitigation}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Contract management</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="text-right">Annual spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.vendor}>
                    <TableCell className="font-medium text-[12.5px]">{c.vendor}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10.5px] border-0",
                          c.status === "Active" && "bg-success-soft text-success",
                          c.status === "Renegotiating" && "bg-amber-soft text-amber-brand",
                          c.status === "Expiring" && "bg-coral-soft text-coral",
                        )}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-[12px]">{c.renewal}</TableCell>
                    <TableCell className="tabular text-right">
                      ${c.spend.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

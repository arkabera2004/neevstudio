import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/branding";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download } from "lucide-react";

export const Route = createFileRoute("/_app/traceability")({
  head: () => ({
    meta: [
      { title: `Traceability Explorer — ${APP_NAME}` },
      { name: "description", content: "Graph + table hybrid view of the full traceability spine." },
    ],
  }),
  component: TraceabilityPage,
});

// Graph node definition for the SVG
const nodes = [
  { id: "SW-122", label: "SW-122\nApnea detection", x: 90, y: 200, type: "SW" },
  { id: "BC-06", label: "BC-06\nApnea start ≤4.0s", x: 320, y: 90, type: "BC" },
  { id: "REQ-1058", label: "REQ-1058\nBackup ventilation start", x: 320, y: 310, type: "REQ" },
  { id: "TC-08840", label: "TC-08840\nApnea backup test", x: 570, y: 200, type: "TC" },
  { id: "HW-221", label: "HW-221\nBlower drive", x: 800, y: 110, type: "HW" },
  { id: "IEC 80601-2-12", label: "ISO 80601-2-12\n§201.12.1.103", x: 800, y: 310, type: "STD" },
];

const edges: [string, string, string][] = [
  ["SW-122", "REQ-1058", "contains"],
  ["BC-06", "REQ-1058", "classifies"],
  ["REQ-1058", "TC-08840", "verified-by"],
  ["TC-08840", "HW-221", "exercises"],
  ["BC-06", "IEC 80601-2-12", "sourced-from"],
];

const typeColor: Record<string, string> = {
  SW: "var(--color-sw)",
  HW: "var(--color-hw)",
  BC: "var(--color-amber-brand)",
  REQ: "var(--color-teal)",
  TC: "var(--color-coral)",
  STD: "var(--color-muted-foreground)",
};

function findNode(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function TraceabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Traceability Explorer"
        subtitle="One graph, one table — click REQ-1058 and see the unbroken chain"
        actions={
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export trace
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input defaultValue="REQ-1058" className="h-8" />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {Object.entries(typeColor).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: v }} />
                <span className="text-muted-foreground">{k}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
            <svg viewBox="0 0 900 400" className="w-full h-[400px]">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
                </marker>
              </defs>
              {edges.map(([a, b, label], i) => {
                const na = findNode(a);
                const nb = findNode(b);
                return (
                  <g key={i}>
                    <line
                      x1={na.x}
                      y1={na.y}
                      x2={nb.x}
                      y2={nb.y}
                      stroke="var(--color-muted-foreground)"
                      strokeWidth="1.5"
                      strokeOpacity="0.5"
                      markerEnd="url(#arrow)"
                    />
                    <text
                      x={(na.x + nb.x) / 2}
                      y={(na.y + nb.y) / 2 - 6}
                      fontSize="10"
                      fill="var(--color-muted-foreground)"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              {nodes.map((n) => {
                const isFocus = n.id === "REQ-1058";
                return (
                  <g key={n.id} transform={`translate(${n.x - 70}, ${n.y - 24})`}>
                    <rect
                      width="140"
                      height="48"
                      rx="8"
                      fill="var(--color-card)"
                      stroke={typeColor[n.type]}
                      strokeWidth={isFocus ? 2.5 : 1.2}
                    />
                    {n.label.split("\n").map((line, i) => (
                      <text
                        key={i}
                        x="70"
                        y={i === 0 ? 18 : 34}
                        textAnchor="middle"
                        fontSize={i === 0 ? 11 : 10}
                        fontWeight={i === 0 ? 600 : 400}
                        fill={i === 0 ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Trace table · REQ-1058</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hop</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  h: 1,
                  f: "SW-122 Apnea detection",
                  r: "contains",
                  t: "REQ-1058",
                  d: "upstream",
                  s: "active",
                },
                {
                  h: 2,
                  f: "BC-06 Apnea start ≤4.0s",
                  r: "classifies",
                  t: "REQ-1058",
                  d: "upstream",
                  s: "active",
                },
                {
                  h: 3,
                  f: "ISO 80601-2-12 §201.12.1.103",
                  r: "sourced-from",
                  t: "BC-06",
                  d: "upstream",
                  s: "active",
                },
                {
                  h: 4,
                  f: "REQ-1058",
                  r: "verified-by",
                  t: "TC-08840",
                  d: "downstream",
                  s: "Fail",
                },
                {
                  h: 5,
                  f: "TC-08840",
                  r: "exercises",
                  t: "HW-221 Blower drive",
                  d: "downstream",
                  s: "active",
                },
              ].map((r) => (
                <TableRow key={r.h}>
                  <TableCell className="tabular">{r.h}</TableCell>
                  <TableCell className="text-[12.5px]">{r.f}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{r.r}</TableCell>
                  <TableCell className="text-[12.5px] font-medium">{r.t}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10.5px]">
                      {r.d}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        "text-[10.5px] border-0 " +
                        (r.s === "Fail"
                          ? "bg-coral-soft text-coral"
                          : "bg-success-soft text-success")
                      }
                    >
                      {r.s}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

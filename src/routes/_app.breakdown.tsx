import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { breakdown, type BreakdownNode } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { BreakdownTree } from "@/components/BreakdownTree";
import { domainStyle } from "@/lib/breakdown-styles";
import { MessageSquare, RefreshCw, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/breakdown")({
  head: () => ({
    meta: [
      { title: `Product Breakdown — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Decomposition tree from system to part level with classification, comments, and version history.",
      },
    ],
  }),
  component: BreakdownPage,
});

function BreakdownPage() {
  const [selected, setSelected] = useState<BreakdownNode>(breakdown);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Breakdown"
        subtitle="Aeris V500 · decomposed to part level for safety-heavy subsystems"
        actions={
          <>
            <Button variant="outline" size="sm">
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              Version history
            </Button>
            <Button size="sm">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Re-decompose
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Total requirements", v: "428" },
          { l: "SW / HW split", v: "236 / 192" },
          { l: "Nodes", v: "76" },
          { l: "Deepest branch", v: "L4" },
        ].map((s) => (
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

      {/* Tree + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Decomposition tree</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              Click a node to view details · re-decompose scoped to any subtree
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[640px] overflow-y-auto pr-2">
              <BreakdownTree root={breakdown} onSelect={setSelected} selectedId={selected.id} />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit sticky top-20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn("h-5 text-[10px] px-1.5 border-0", domainStyle[selected.domain])}
              >
                {selected.domain}
              </Badge>
              <span className="tabular text-[11px] text-muted-foreground">{selected.id}</span>
              <span className="ml-auto text-[11px] text-muted-foreground tabular">
                L{selected.level}
              </span>
            </div>
            <CardTitle className="text-base mt-1">{selected.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground">
              Element responsible for {selected.name.toLowerCase()}. {selected.reqs} requirements
              resolve under this node.
            </p>

            <dl className="grid grid-cols-2 gap-y-2 text-[12px]">
              <dt className="text-muted-foreground">Domain</dt>
              <dd>{selected.domain}</dd>
              <dt className="text-muted-foreground">Requirements</dt>
              <dd className="tabular">{selected.reqs}</dd>
              <dt className="text-muted-foreground">Classification</dt>
              <dd>{selected.classification ?? "—"}</dd>
              <dt className="text-muted-foreground">Governing std</dt>
              <dd>ISO 80601-2-12</dd>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="tabular">v3.2</dd>
              <dt className="text-muted-foreground">Last change</dt>
              <dd>2h ago · R. Vasquez</dd>
            </dl>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Re-decompose
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Comments
              </div>
              <div className="space-y-2">
                <div className="rounded-md border border-border p-2.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">R. Vasquez</span>
                    <span className="tabular text-[10.5px] text-muted-foreground">3d ago</span>
                  </div>
                  <div className="mt-1 text-foreground/85">
                    Split further per DFMEA review 3/12 — need dedicated inspiratory valve node.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

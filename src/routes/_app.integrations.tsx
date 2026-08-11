import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { integrations } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { Plug, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({
    meta: [
      { title: `Integrations — ${APP_NAME}` },
      { name: "description", content: "PLM, ALM, ERP, e-signature and email gateway connectors." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connected systems · field mapping and conflict resolution per connector"
        actions={
          <Button size="sm">
            <Plug className="h-3.5 w-3.5 mr-1.5" />
            Add integration
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((i) => (
          <Card key={i.name}>
            <CardHeader className="pb-2 flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/12 text-primary flex items-center justify-center font-semibold text-[13px]">
                {i.vendor.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-semibold">{i.name}</CardTitle>
                <div className="text-[11px] text-muted-foreground">{i.vendor}</div>
              </div>
              <Badge
                className={cn(
                  "text-[10.5px] border-0",
                  i.status === "Active" && "bg-success-soft text-success",
                  i.status === "Degraded" && "bg-amber-soft text-amber-brand",
                  i.status === "Disconnected" && "bg-coral-soft text-coral",
                )}
              >
                {i.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                <dt className="text-muted-foreground">Last sync</dt>
                <dd className="tabular">{i.lastSync}</dd>
                <dt className="text-muted-foreground">Records</dt>
                <dd className="tabular">{i.records.toLocaleString()}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{i.sync}</dd>
                <dt className="text-muted-foreground">Conflict rule</dt>
                <dd>source wins</dd>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  Configure
                </Button>
                <Button size="sm" variant="ghost">
                  Sync now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

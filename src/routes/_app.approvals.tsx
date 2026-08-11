import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approvals } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/approvals")({
  head: () => ({
    meta: [
      { title: `Approvals Queue — ${APP_NAME}` },
      {
        name: "description",
        content: "Every pending human-in-the-loop item across every workstream.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals Queue"
        subtitle="6 items pending · design-control actions gated by e-signature"
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "High priority", v: 2, tone: "coral" },
          { l: "Medium", v: 3, tone: "amber" },
          { l: "Low", v: 1, tone: "muted" },
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
                  s.tone === "amber" && "text-amber-brand",
                )}
              >
                {s.v}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {approvals.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                    a.priority === "High"
                      ? "bg-coral-soft text-coral"
                      : a.priority === "Medium"
                        ? "bg-amber-soft text-amber-brand"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-semibold">{a.kind}</span>
                    <Badge variant="secondary" className="tabular text-[10.5px]">
                      {a.entity}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-[10.5px] border-0 ml-auto",
                        a.priority === "High" && "bg-coral-soft text-coral",
                        a.priority === "Medium" && "bg-amber-soft text-amber-brand",
                        a.priority === "Low" && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {a.priority}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[13px] text-foreground/85">{a.proposal}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11.5px] text-muted-foreground tabular">
                    <span>
                      Proposed by <span className="text-foreground/80">{a.by}</span>
                    </span>
                    <span>·</span>
                    <span>{a.when}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline">
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Comment
                  </Button>
                  <Button size="sm" variant="outline">
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reject
                  </Button>
                  <Button size="sm">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

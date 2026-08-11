import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocPanel, DOC_LABEL, countRows } from "./DocsetResult";
import { StatusIcon, useStickToBottom } from "./progress-shared";
import type { DocGenJob } from "@/lib/api";
import { FileText, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocsetProgress({ job }: { job: DocGenJob }) {
  const [tab, setTab] = useState<string | undefined>(undefined);
  const docCount = job.docs.length;

  // Auto-advance to each document as the chain produces it.
  useEffect(() => {
    if (docCount > 0) setTab(job.docs[docCount - 1].doc_type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docCount]);

  const totalRows = job.docs.reduce((n, d) => n + countRows(d), 0);
  useStickToBottom(totalRows);
  const done = job.stages.filter((s) => s.status === "done" || s.status === "failed").length;
  const pct = Math.round((done / job.stages.length) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">Generating the document set…</div>
              <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job.source_name}</span>
              </div>
            </div>
            <div className="ml-auto tabular text-[12px] text-muted-foreground">{pct}%</div>
          </div>

          <Progress value={pct} className="h-1.5 mt-4" />

          {/* The chain, visualized: product → hardware → software → labeling → export. */}
          <div className="mt-5 flex flex-wrap items-start gap-x-1 gap-y-3">
            {job.stages.map((s, i) => (
              <div key={s.key} className="flex items-start gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-[3px]" />
                )}
                <div className="max-w-[150px]">
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <StatusIcon status={s.status} small />
                    <span
                      className={cn(
                        "font-medium",
                        s.status === "pending" && "text-muted-foreground/60",
                      )}
                    >
                      {s.label.replace("Deriving ", "").replace("Generating ", "")}
                    </span>
                  </div>
                  {s.detail && (
                    <div
                      className={cn(
                        "text-[10.5px] mt-0.5 leading-snug",
                        s.status === "failed" ? "text-coral" : "text-muted-foreground",
                      )}
                    >
                      {s.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md bg-muted/50 p-3 text-[11.5px] text-muted-foreground leading-relaxed">
            Real generation — four chained model calls, each one seeing the documents before it so
            the requirement IDs line up across the set. Each document appears below the moment its
            call returns.
          </div>
        </CardContent>
      </Card>

      {docCount > 0 && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {(["product", "hardware", "software", "labeling"] as const).map((dt) => {
              const doc = job.docs.find((d) => d.doc_type === dt);
              const stage = job.stages.find((s) => s.key === dt);
              return (
                <TabsTrigger key={dt} value={dt} disabled={!doc}>
                  {stage?.status === "running" && !doc ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  {DOC_LABEL[dt]}
                  {doc && <span className="ml-1.5 text-[11px] opacity-60">{countRows(doc)}</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {job.docs.map((doc) => (
            <TabsContent key={doc.doc_type} value={doc.doc_type} className="mt-4">
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <DocPanel doc={doc} job={job} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listBreakdownRuns, type BreakdownRunSummary } from "@/lib/api";
import { History } from "lucide-react";

/** Picker over completed breakdowns persisted on the backend (Postgres), so past
 *  runs survive tab switches and backend restarts. Used by New Breakdown (reload
 *  a run) and by Classification (choose a breakdown to classify) — pass `trigger`
 *  to restyle the popover button per page. */
export function PreviousBreakdowns({
  onLoad,
  trigger,
}: {
  onLoad: (runId: string) => void;
  trigger?: React.ReactNode;
}) {
  const [runs, setRuns] = useState<BreakdownRunSummary[] | null>(null);

  async function open(isOpen: boolean) {
    if (!isOpen || runs) return;
    try {
      setRuns(await listBreakdownRuns());
    } catch {
      setRuns([]);
    }
  }

  return (
    <Popover onOpenChange={open}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="w-full justify-start text-[12.5px]">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Previous breakdowns
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-1.5">
        {runs === null && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">Loading…</div>
        )}
        {runs?.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">
            No previous breakdowns yet. Completed runs are saved automatically.
          </div>
        )}
        {runs?.map((run) => (
          <button
            key={run.run_id}
            onClick={() => onLoad(run.run_id)}
            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <div className="text-[12.5px] font-medium truncate">
                {run.product ?? run.source_name}
              </div>
              {run.status === "partial" && (
                <Badge className="h-4 text-[9.5px] border-0 bg-amber-soft text-amber-brand shrink-0">
                  partial
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {run.source_kind === "document" ? "Document" : "Concept"} · {run.requirement_count}{" "}
              requirements · {new Date(run.created_at).toLocaleString()}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

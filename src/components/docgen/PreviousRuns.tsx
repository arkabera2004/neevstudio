import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listRuns, type RunSummary } from "@/lib/api";
import { History } from "lucide-react";

/** Recovery path for a live demo: every completed run is persisted on the
 *  backend, so a network or model failure on stage can be answered by loading
 *  the rehearsal run instead of re-rolling the dice. Filtered to one mode so
 *  each page only offers runs it can actually render. */
export function PreviousRuns({
  mode,
  label,
  onLoad,
}: {
  mode: "matrix" | "docset";
  label: string;
  onLoad: (runId: string) => void;
}) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);

  async function open(isOpen: boolean) {
    if (!isOpen || runs) return;
    try {
      setRuns((await listRuns()).filter((r) => r.mode === mode));
    } catch {
      setRuns([]);
    }
  }

  return (
    <Popover onOpenChange={open}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-[12.5px]">
          <History className="h-3.5 w-3.5 mr-1.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-1.5">
        {runs === null && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">Loading…</div>
        )}
        {runs?.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">
            No previous runs yet. Completed runs are saved automatically.
          </div>
        )}
        {runs?.map((run) => (
          <button
            key={run.run_id}
            onClick={() => onLoad(run.run_id)}
            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="text-[12.5px] font-medium truncate">{run.source_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {run.created_at} · {run.file_count} files
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

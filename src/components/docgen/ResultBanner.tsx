import type { DocGenJob } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Terminal-status banner for a docgen job: outcome and duration. */
export function ResultBanner({ job }: { job: DocGenJob }) {
  const tone =
    job.status === "succeeded"
      ? "border-success/30 bg-success-soft/40"
      : job.status === "partial"
        ? "border-amber-brand/30 bg-amber-soft/40"
        : "border-coral/30 bg-coral-soft/40";

  const seconds = job.duration_ms ? (job.duration_ms / 1000).toFixed(1) : null;

  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px]", tone)}>
      {job.status === "succeeded" ? (
        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
      ) : job.status === "partial" ? (
        <AlertTriangle className="h-4 w-4 text-amber-brand shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-coral shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <span>
          {job.status === "succeeded" && "Generation complete."}
          {job.status === "partial" &&
            "Generated with gaps — some stages failed, the rest exported normally."}
          {job.status === "failed" && (job.error || "Generation failed.")}
        </span>
        <span className="text-muted-foreground">{seconds && ` ${seconds}s`}</span>
      </div>
    </div>
  );
}

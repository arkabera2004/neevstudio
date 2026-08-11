import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { riskStyle } from "@/lib/breakdown-styles";
import type { DocGenJob } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DownloadButton } from "./DownloadButton";
import { MatrixSectionCard } from "./MatrixSectionCard";

/** On-screen twin of the exported compliance matrix: the same seven columns, in
 *  the same order, so what the customer sees here is what opens in Word. */
export function MatrixResult({ job }: { job: DocGenJob }) {
  const matrix = job.matrix;
  if (!matrix) return null;

  const rows = matrix.sections.flatMap((s) => s.rows);
  const pending = rows.filter((r) => !r.enriched).length;
  const counts = {
    High: rows.filter((r) => r.risk_level === "High").length,
    Medium: rows.filter((r) => r.risk_level === "Medium").length,
    Low: rows.filter((r) => r.risk_level === "Low").length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{matrix.doc_title}</div>
              {matrix.subtitle && (
                <div className="text-[12.5px] text-muted-foreground mt-0.5">{matrix.subtitle}</div>
              )}
              <div className="text-[11.5px] text-muted-foreground mt-2">
                Base requirements taken verbatim from{" "}
                <span className="font-medium">{matrix.source_name}</span>. Rationale, standards,
                compliance approach, hazard and risk level added for DHF traceability.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.files.map((f) => (
                <DownloadButton key={f.name} file={f} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground mr-1">
              {rows.length} requirements · {matrix.sections.length} sections
            </span>
            {(["High", "Medium", "Low"] as const).map((level) =>
              counts[level] ? (
                <Badge
                  key={level}
                  className={cn("text-[11px]", riskStyle[level])}
                  variant="secondary"
                >
                  {counts[level]} {level}
                </Badge>
              ) : null,
            )}
            {pending > 0 && (
              <Badge variant="secondary" className="text-[11px] bg-secondary text-muted-foreground">
                {pending} pending SME review
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {matrix.sections.map((section) => (
        <MatrixSectionCard key={section.title} title={section.title} rows={section.rows} />
      ))}
    </div>
  );
}

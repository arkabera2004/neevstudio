import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { riskStyle } from "@/lib/breakdown-styles";
import type { MatrixRow } from "@/lib/api";
import { cn } from "@/lib/utils";

/** One section of the seven-column compliance matrix.
 *
 *  Shared between the live progress view and the final result view so the
 *  running→done handoff never reflows: the same markup renders in both, the
 *  live view just adds skeleton rows for work still in flight. */
export function MatrixSectionCard({
  title,
  rows,
  headerNote,
  skeletonRows = 0,
  animateRows = false,
}: {
  title: string;
  rows: MatrixRow[];
  headerNote?: React.ReactNode;
  /** Placeholder rows rendered below the real ones while the model works. */
  skeletonRows?: number;
  /** Fade/slide new rows in — used by the live view only. */
  animateRows?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <span className="text-[13.5px] font-semibold">{title}</span>
          <span className="text-[11.5px] text-muted-foreground">{rows.length} requirements</span>
          {headerNote}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[92px]">Req ID</TableHead>
                <TableHead className="min-w-[220px]">Requirement</TableHead>
                <TableHead className="min-w-[200px]">Rationale</TableHead>
                <TableHead className="min-w-[170px]">Applicable Standard(s)</TableHead>
                <TableHead className="min-w-[200px]">Compliance Approach</TableHead>
                <TableHead className="min-w-[200px]">Risk / Hazard Addressed</TableHead>
                <TableHead className="w-[104px]">Risk Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.req_id}
                  className={cn(
                    !row.enriched && "opacity-60",
                    animateRows && "animate-in fade-in slide-in-from-bottom-1 duration-300",
                  )}
                >
                  <TableCell className="font-medium tabular align-top">{row.req_id}</TableCell>
                  <TableCell className="text-[12.5px] align-top">{row.requirement}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground align-top">
                    {row.rationale ?? "—"}
                  </TableCell>
                  <TableCell className="text-[12px] align-top">{row.standards ?? "—"}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground align-top">
                    {row.compliance_approach ?? "—"}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground align-top">
                    {row.risk_hazard ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    {row.risk_level ? (
                      <Badge
                        variant="secondary"
                        className={cn("text-[11px]", riskStyle[row.risk_level])}
                      >
                        {row.risk_level}
                      </Badge>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 7 }).map((__, col) => (
                    <TableCell key={col} className="align-top">
                      <Skeleton className="h-3 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

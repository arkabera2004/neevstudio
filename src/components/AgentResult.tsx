import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentResult as AgentResultData, Section } from "@/lib/api";

function SectionView({ section }: { section: Section }) {
  const title = "title" in section && section.title ? section.title : undefined;

  return (
    <div className="space-y-2">
      {title && (
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}

      {section.type === "table" && (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {section.columns.map((c) => (
                  <TableHead key={c} className="text-[11px]">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="text-[12px] align-top">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {section.type === "list" && (
        <ul className="list-disc pl-5 space-y-1 text-[12.5px]">
          {section.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}

      {section.type === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {section.items.map((it, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12.5px] font-medium">{it.title}</div>
                {it.badge && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {it.badge}
                  </Badge>
                )}
              </div>
              {it.subtitle && (
                <div className="tabular text-[11px] text-muted-foreground mt-0.5">
                  {it.subtitle}
                </div>
              )}
              {it.body && (
                <div className="text-[12px] text-foreground/85 mt-1.5 whitespace-pre-wrap">
                  {it.body}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {section.type === "kv" && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
          {section.pairs.map((p, i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{p.key}</dt>
              <dd className="tabular">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {section.type === "markdown" && (
        <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-foreground/90">
          {section.text}
        </div>
      )}
    </div>
  );
}

export function AgentResult({ data }: { data: AgentResultData }) {
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-foreground/90">{data.summary}</p>
      {data.sections.map((s, i) => (
        <SectionView key={i} section={s} />
      ))}
    </div>
  );
}

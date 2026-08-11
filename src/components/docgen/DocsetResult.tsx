import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { DocGenJob, FileInfo, GeneratedDoc } from "@/lib/api";
import { DownloadButton } from "./DownloadButton";
import { Loader2, Network } from "lucide-react";

export const DOC_LABEL: Record<GeneratedDoc["doc_type"], string> = {
  product: "Product",
  hardware: "Hardware",
  software: "Software",
  labeling: "Labeling",
};

export function countRows(doc: GeneratedDoc): number {
  return doc.sections.reduce((n, s) => n + s.rows.length, 0);
}

export function DocPanel({
  doc,
  job,
  onBreakdown,
  breakingDown,
}: {
  doc: GeneratedDoc;
  job: DocGenJob;
  /** When set, offers to feed this document's .docx into the breakdown pipeline. */
  onBreakdown?: (file: FileInfo) => void;
  breakingDown?: boolean;
}) {
  // The docx/csv for this document, matched by the label the backend set.
  const files = job.files.filter((f) => f.label.startsWith(DOC_LABEL[doc.doc_type]));
  const docx = files.find((f) => f.kind === "docx");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{doc.title}</div>
              <div className="text-[12.5px] text-muted-foreground mt-0.5">{doc.product_name}</div>
              {(doc.purpose || doc.scope) && (
                <p className="text-[12.5px] mt-2 leading-relaxed">{doc.purpose || doc.scope}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <DownloadButton key={f.name} file={f} />
              ))}
              {onBreakdown && docx && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-[12.5px]"
                  disabled={breakingDown}
                  onClick={() => onBreakdown(docx)}
                >
                  {breakingDown ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Network className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Break down this document
                </Button>
              )}
            </div>
          </div>

          {doc.context_table.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4 pt-3 border-t border-border">
              {doc.context_table.map((kv) => (
                <div key={kv.label} className="flex gap-2 text-[12px]">
                  <dt className="text-muted-foreground shrink-0">{kv.label}:</dt>
                  <dd className="min-w-0">{kv.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {doc.overview_table.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b border-border text-[13.5px] font-semibold">
              Product Overview
            </div>
            <Table>
              <TableBody>
                {doc.overview_table.map((kv) => (
                  <TableRow key={kv.label}>
                    <TableCell className="w-[200px] font-medium align-top">{kv.label}</TableCell>
                    <TableCell className="text-[12.5px] align-top">{kv.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {doc.sections
        .filter((s) => s.rows.length > 0)
        .map((section) => (
          <Card key={section.title}>
            <CardContent className="p-0">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="text-[13.5px] font-semibold">{section.title}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {section.rows.length} requirements
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[132px]">Req ID</TableHead>
                    <TableHead>Requirement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((row) => (
                    <TableRow key={row.req_id}>
                      <TableCell className="font-medium tabular align-top">{row.req_id}</TableCell>
                      <TableCell className="text-[12.5px] align-top">{row.text}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

export function DocsetResult({
  job,
  onBreakdown,
  breakingDown,
}: {
  job: DocGenJob;
  onBreakdown?: (file: FileInfo) => void;
  breakingDown?: boolean;
}) {
  if (job.docs.length === 0) return null;
  const zip = job.files.find((f) => f.kind === "zip");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">
              {job.docs.length} documents · {job.docs.reduce((n, d) => n + countRows(d), 0)}{" "}
              requirements
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Generated from: <span className="italic">{job.source_name}</span>
            </div>
          </div>
          {zip && <DownloadButton file={zip} variant="default" />}
        </CardContent>
      </Card>

      <Tabs defaultValue={job.docs[0].doc_type}>
        <TabsList>
          {job.docs.map((doc) => (
            <TabsTrigger key={doc.doc_type} value={doc.doc_type}>
              {DOC_LABEL[doc.doc_type]}
              <span className="ml-1.5 text-[11px] opacity-60">{countRows(doc)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {job.docs.map((doc) => (
          <TabsContent key={doc.doc_type} value={doc.doc_type} className="mt-4">
            <DocPanel doc={doc} job={job} onBreakdown={onBreakdown} breakingDown={breakingDown} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

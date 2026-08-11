import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditTrail } from "@/lib/mock-data";
import { APP_NAME } from "@/lib/branding";
import { Download, Search, Lock } from "lucide-react";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({
    meta: [
      { title: `Audit Trail — ${APP_NAME}` },
      {
        name: "description",
        content: "Immutable append-only log of every human and agent action.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Append-only · immutable through the application · exportable for regulatory audit"
        actions={
          <>
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Lock className="h-3 w-3" /> read-only
            </div>
            <Button size="sm" variant="outline">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Filter by user, entity, action…" className="h-8 pl-8" />
            </div>
            {["All actions", "User", "Entity", "Date"].map((f) => (
              <Button key={f} size="sm" variant="outline" className="h-8 text-[11.5px]">
                {f}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp (UTC)</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditTrail.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular text-[12px]">{e.ts}</TableCell>
                  <TableCell className="text-[12.5px] font-medium">{e.user}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{e.role}</TableCell>
                  <TableCell>
                    <span className="tabular text-[12px] font-mono bg-muted px-1.5 py-0.5 rounded">
                      {e.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {e.entityType} · <span className="tabular">{e.entityId}</span>
                  </TableCell>
                  <TableCell className="tabular text-[12px] text-muted-foreground">
                    {e.before ?? "—"}
                  </TableCell>
                  <TableCell className="tabular text-[12px]">{e.after ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

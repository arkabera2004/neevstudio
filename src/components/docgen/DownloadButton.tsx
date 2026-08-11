import { Button } from "@/components/ui/button";
import { API_URL, type FileInfo } from "@/lib/api";
import { Download, FileSpreadsheet, FileText, FileArchive } from "lucide-react";

const icons = {
  docx: FileText,
  csv: FileSpreadsheet,
  zip: FileArchive,
};

function humanSize(bytes: number): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

/** Links straight at the backend — it streams the file with a
 *  Content-Disposition header, so no blob round-trip is needed here. */
export function DownloadButton({
  file,
  variant = "outline",
}: {
  file: FileInfo;
  variant?: "outline" | "default";
}) {
  const Icon = icons[file.kind] ?? Download;
  const size = humanSize(file.size_bytes);
  return (
    <Button variant={variant} size="sm" asChild>
      <a href={`${API_URL}${file.url}`} download={file.name}>
        <Icon className="h-3.5 w-3.5 mr-1.5" />
        {file.label}
        {size && <span className="ml-1.5 text-[11px] opacity-60">{size}</span>}
      </a>
    </Button>
  );
}

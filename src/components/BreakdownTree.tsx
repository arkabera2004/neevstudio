import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BreakdownNode } from "@/lib/mock-data";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { classStyle, domainStyle } from "@/lib/breakdown-styles";

export function TreeNode({
  node,
  depth = 0,
  onSelect,
  selectedId,
}: {
  node: BreakdownNode;
  depth?: number;
  onSelect: (n: BreakdownNode) => void;
  selectedId: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const selected = selectedId === node.id;
  return (
    <div>
      <div
        onClick={() => onSelect(node)}
        className={cn(
          "group flex items-center gap-2 py-1.5 pr-3 rounded-md cursor-pointer text-[13px] hover:bg-muted/60",
          selected && "bg-primary/8 ring-1 ring-primary/20",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className={cn(
            "h-4 w-4 flex items-center justify-center text-muted-foreground shrink-0",
            !hasChildren && "invisible",
          )}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <Badge
          variant="outline"
          className={cn("h-5 text-[10px] px-1.5 tabular border-0", domainStyle[node.domain])}
        >
          {node.domain}
        </Badge>
        <span className="tabular text-muted-foreground text-[11px]">{node.id}</span>
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {node.classification && (
            <Badge
              variant="outline"
              className={cn("h-5 text-[10px] px-1.5 border-0", classStyle[node.classification])}
            >
              {node.classification}
            </Badge>
          )}
          <span className="tabular text-[11px] text-muted-foreground">{node.reqs} req</span>
          <span className="tabular text-[10.5px] text-muted-foreground/70">L{node.level}</span>
        </span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children!.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BreakdownTree({
  root,
  selectedId,
  onSelect,
}: {
  root: BreakdownNode;
  selectedId: string;
  onSelect: (n: BreakdownNode) => void;
}) {
  return <TreeNode node={root} onSelect={onSelect} selectedId={selectedId} />;
}

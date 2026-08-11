import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusIcon({ status, small }: { status: string; small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-4 w-4";
  if (status === "done") return <CheckCircle2 className={cn(size, "text-success shrink-0")} />;
  if (status === "running")
    return <Loader2 className={cn(size, "text-primary animate-spin shrink-0")} />;
  if (status === "failed") return <AlertTriangle className={cn(size, "text-coral shrink-0")} />;
  return <div className={cn(size, "rounded-full border border-border shrink-0")} />;
}

/** Keeps the window pinned to the bottom while new rows stream in — but only if
 *  the user is already near the bottom; scrolling up to read pauses it. */
export function useStickToBottom(dep: number) {
  const stuck = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (dep > 0 && stuck.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }, [dep]);
}

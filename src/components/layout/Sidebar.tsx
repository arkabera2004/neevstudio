import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import {
  LayoutDashboard,
  FilePlus2,
  FileOutput,
  Network,
  ShieldCheck,
  ListChecks,
  FlaskConical,
  Cpu,
  Waypoints,
  Bot,
  ClipboardCheck,
  FileBarChart,
  Settings,
  Plug,
  History,
  Activity,
} from "lucide-react";

const groups = [
  {
    label: "Lifecycle",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/new-breakdown", label: "New Breakdown", icon: FilePlus2 },
      { to: "/requirements-matrix", label: "Requirements Matrix", icon: FileOutput },
      { to: "/breakdown", label: "Product Breakdown", icon: Network, meta: "428 req" },
      { to: "/compliance", label: "Compliance & Standards", icon: ShieldCheck, meta: "10" },
      { to: "/classification", label: "CTS / CTQ Classification", icon: ListChecks },
      { to: "/verification", label: "Verification (V-Model)", icon: FlaskConical, meta: "87%" },
      { to: "/hardware", label: "Hardware & BOM", icon: Cpu, meta: "342" },
    ],
  },
  {
    label: "Traceability",
    items: [{ to: "/traceability", label: "Traceability Explorer", icon: Waypoints }],
  },
  {
    label: "Platform",
    items: [
      { to: "/capabilities", label: "AI Capability Map", icon: Bot },
      {
        to: "/agent-runs",
        label: "Agent Runs / Queue",
        icon: Activity,
        badge: "2 failed",
        tone: "coral" as const,
      },
      {
        to: "/approvals",
        label: "Approvals Queue",
        icon: ClipboardCheck,
        badge: "6 pending",
        tone: "amber" as const,
      },
    ],
  },
  {
    label: "Reports",
    items: [{ to: "/reports", label: "Reports & Exports", icon: FileBarChart }],
  },
  {
    label: "Settings",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/audit", label: "Audit Trail", icon: History },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Nav content shared by the desktop rail and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { location } = useRouterState();
  const path = location.pathname;

  return (
    <>
      <div className="flex flex-col items-center gap-2 px-5 py-6 border-b border-sidebar-border">
        <img
          src="/brand/wayam-logo-dark-bg.svg"
          alt="Wayam AI"
          className="h-9 w-auto"
          width={220}
          height={62}
        />
        <div className="text-[10.5px] tracking-wide text-sidebar-foreground/70 text-center">
          {APP_NAME} - {APP_TAGLINE}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 lg:py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "opacity-75")}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {"meta" in item && item.meta && (
                        <span className="tabular text-[10.5px] text-sidebar-foreground/60">
                          {item.meta}
                        </span>
                      )}
                      {"badge" in item && item.badge && (
                        <span
                          className={cn(
                            "tabular rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            item.tone === "coral" && "bg-coral/20 text-coral",
                            item.tone === "amber" && "bg-amber-brand/20 text-amber-brand",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/60">
        v2.14.0 · build 8842
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex h-screen w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground sticky top-0">
      <SidebarNav />
    </aside>
  );
}

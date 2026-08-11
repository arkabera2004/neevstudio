import { useState } from "react";
import { Search, Bell, Settings, Command, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/layout/Sidebar";
import { programs, notifications } from "@/lib/mock-data";

export function Topbar() {
  const [activeProgram, setActiveProgram] = useState(programs[0]);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/90 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-5">
        {/* Mobile nav trigger */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-4.5 w-4.5" />
            <span className="sr-only">Open navigation</span>
          </Button>
          <SheetContent
            side="left"
            className="w-[280px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col [&>button]:text-sidebar-foreground"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Program switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2.5">
              <div className="h-6 w-6 rounded bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold">
                {activeProgram.name.slice(0, 2)}
              </div>
              <div className="text-left leading-tight">
                <div className="text-[13px] font-semibold">{activeProgram.name}</div>
                <div className="text-[10.5px] text-muted-foreground">{activeProgram.subtitle}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Switch program</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {programs.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => setActiveProgram(p)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular text-[11px] text-muted-foreground">{p.maturity}%</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {p.subtitle} · {p.stage}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="hidden md:flex relative flex-1 max-w-xl mx-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requirements, parts, standards, test cases…"
            className="h-9 pl-8 pr-14 bg-secondary/50 border-border/60"
          />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" /> K
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-coral" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Badge variant="secondary" className="text-[10px]">
                  {notifications.length}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2">
                  <div className="flex w-full items-center gap-2">
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        (n.severity === "critical"
                          ? "bg-coral"
                          : n.severity === "warn"
                            ? "bg-amber-brand"
                            : "bg-teal")
                      }
                    />
                    <span className="text-[12.5px]">{n.text}</span>
                  </div>
                  <span className="pl-3.5 text-[10.5px] text-muted-foreground">{n.when}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-1.5 pr-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                    AB
                  </AvatarFallback>
                </Avatar>
                <div className="text-left leading-tight hidden sm:block">
                  <div className="text-[12.5px] font-medium">A. Bermejo</div>
                  <div className="text-[10px] text-muted-foreground">Program Manager</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
              <DropdownMenuItem className="flex-col items-start">
                <div className="text-sm font-medium">A. Bermejo</div>
                <div className="text-[11px] text-muted-foreground">
                  Program Manager · Aeris V500
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile & preferences</DropdownMenuItem>
              <DropdownMenuItem>Switch role</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

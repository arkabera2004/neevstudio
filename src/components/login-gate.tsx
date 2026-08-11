import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/branding";

// Demo credential check — there's no user backend yet, so this validates
// against one fixed account rather than accepting any email/password. Real
// accounts (and a real auth backend) replace this later.
//
// Deliberately not persisted (no localStorage/cookie) — every fresh load of
// the app (new tab, reload, reopening the link) shows the login page again.
// Signing in only unlocks the current in-memory session.
const DEMO_EMAIL = "demo@neevstudio.ai";
const DEMO_PASSWORD = "Joules@123";

export function LoginGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const emailMatches = email.trim().toLowerCase() === DEMO_EMAIL;
    if (emailMatches && password === DEMO_PASSWORD) {
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-4">
      <img src="/brand/wayam-logo-light-bg.svg" alt="Wayam AI" className="h-9 w-auto" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>Sign in with your email and password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoFocus
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
              />
              {error && (
                <p className="text-sm text-destructive">Incorrect email or password.</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Demo access: {DEMO_EMAIL} / {DEMO_PASSWORD}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

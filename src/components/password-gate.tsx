import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/branding";

// Shared demo password — a speed bump for anyone who stumbles across the link,
// not real security (it ships in the client bundle). Replaced by user accounts later.
const GATE_PASSWORD = "Joules@123";
// Stored value is the password itself, so rotating the password re-gates everyone.
const GATE_STORAGE_KEY = "veritrace-gate";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" && localStorage.getItem(GATE_STORAGE_KEY);
    if (stored === GATE_PASSWORD) setUnlocked(true);
  }, []);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value === GATE_PASSWORD) {
      try {
        localStorage.setItem(GATE_STORAGE_KEY, GATE_PASSWORD);
      } catch {
        /* ignore */
      }
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>Enter the access password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-password">Password</Label>
              <Input
                id="gate-password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(false);
                }}
              />
              {error && <p className="text-sm text-destructive">Incorrect password.</p>}
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

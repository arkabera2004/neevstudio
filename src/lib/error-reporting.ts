// Local error reporting hook. Logs client-side errors to the console.
// Wire this to your own monitoring service (Sentry, etc.) when you add a backend.

type ErrorContext = Record<string, unknown>;

export function reportError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;
  console.error("[app:error-boundary]", {
    route: window.location.pathname,
    ...context,
    error,
  });
}

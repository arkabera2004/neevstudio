// Badge styling for breakdown nodes and requirements, keyed by domain and
// classification. Lives outside BreakdownTree.tsx so that file only exports
// components (React Fast Refresh requirement) — both the tree and the route
// pages that render requirement tables import these directly.

export const domainStyle = {
  SW: "bg-sw-soft text-sw",
  HW: "bg-hw-soft text-hw",
  LBL: "bg-amber-soft text-amber-brand",
  SYS: "bg-teal-soft text-teal",
};

export const classStyle = {
  CTS: "bg-coral-soft text-coral",
  CTQ: "bg-amber-soft text-amber-brand",
  Standard: "bg-secondary text-muted-foreground",
};

// Risk level on a generated compliance matrix. Mirrors the colour coding of the
// exported Word file (High #C00000, Medium #ED7D31, Low #548235) using the app's
// own soft/text token pairs rather than the print hex values.
export const riskStyle = {
  High: "bg-coral-soft text-coral",
  Medium: "bg-amber-soft text-amber-brand",
  Low: "bg-success-soft text-success",
};

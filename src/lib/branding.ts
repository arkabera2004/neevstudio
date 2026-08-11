// Single switch for the product name shown in the UI.
//
// The customer knows this platform as "ReqIQ" while the internal name is
// Veritrace, and the final naming decision is still open — so every visible
// occurrence reads from here. Override at build/run time with VITE_APP_NAME
// (no code change, no find-and-replace):
//
//   VITE_APP_NAME=ReqIQ npm run dev
export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Veritrace";

/** Long form used in the sidebar wordmark and document titles. */
export const APP_TAGLINE = "Product Development Intelligence";

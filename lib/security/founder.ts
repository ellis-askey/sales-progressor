// Founder gate. The single allowlist for founder-only surfaces (currently the
// Progressor Network while it is proven out with Boardwalk + Annalise). Widen
// the gate by editing FOUNDER_EMAILS.
//
// Kept as a plain, server-safe module (no "use client", no exported Set) so it
// can be imported by BOTH server pages and the client nav builder without
// tripping the client-reference-proxy trap documented in
// lib/agent/experimental-shell.ts.

export const FOUNDER_EMAILS: readonly string[] = [
  "ellis@thesalesprogressor.co.uk", // founder / primary
  "ellisaskey+tb@googlemail.com", // Ellis's agent (director) test account — mirrors DESIGN_LAB_EMAILS
  "ellisaskey@googlemail.com", // Ellis's personal
  "emily@hartwellpartners.co.uk", // Emily Chen (Hartwell & Partners) — director test account for staging-DB preview
];

export function isFounderEmail(email: string | null | undefined): boolean {
  const e = email?.toLowerCase().trim();
  return !!e && FOUNDER_EMAILS.includes(e);
}

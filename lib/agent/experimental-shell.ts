// Server-safe gate for the experimental agent chrome (Floating drawers /
// Compact command bar).
//
// This MUST stay a plain module — do NOT add "use client", and do NOT move the
// allowlist back into a "use client" file. Exporting the Set from the client
// AgentShell module and importing it into the SERVER app/agent/layout.tsx turned
// it into a client-reference proxy at runtime: `.has` was not a function and
// every /agent page threw through the error boundary (prod incident 2026-11-11,
// universal outage). Keeping the value + the check together on the server here
// is what makes the gate safe.
//
// LIVE FOR ALL (founder sign-off, 2026-11-13). The experimental chrome is now
// the default agent shell for every account. The allowlist below is retained
// only as an instant rollback switch: to re-gate, restore the function body to
//   return EXPERIMENTAL_SHELL_EMAILS.has((email ?? "").toLowerCase().trim());
const EXPERIMENTAL_SHELL_EMAILS = new Set<string>([
  "ellis@thesalesprogressor.co.uk",
]);
void EXPERIMENTAL_SHELL_EMAILS;

export function usesExperimentalShell(_email: string | null | undefined): boolean {
  return true;
}

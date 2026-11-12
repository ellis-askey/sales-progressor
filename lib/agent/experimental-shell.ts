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
// Currently EMPTY (shell off for everyone). Re-add the email below to switch the
// experimental shell back on for that account once it is confirmed to render.
const EXPERIMENTAL_SHELL_EMAILS = new Set<string>([
  "ellis@thesalesprogressor.co.uk",
]);

export function usesExperimentalShell(email: string | null | undefined): boolean {
  return EXPERIMENTAL_SHELL_EMAILS.has((email ?? "").toLowerCase().trim());
}

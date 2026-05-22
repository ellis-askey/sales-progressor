// Client-safe constant: milestone codes that clients are HARD-BLOCKED from
// confirming via the portal. B1 of the client-chase arc (Sub-arc B).
//
// These are the three bilateral pairs:
//   - VM18 / PM25  — ready-to-exchange gates
//   - VM19 / PM26  — exchange
//   - VM20 / PM27  — completion
//
// Server enforcement: lib/services/portal.ts portalCompleteMilestone throws
// PORTAL_AGENT_ONLY_ERROR if the milestone code is in this set.
//
// Client enforcement: portal UI strips the Confirm button for these codes
// and shows the explanatory placeholder ("Your agent will confirm this
// once it's done.") so the client understands the absence is deliberate.
//
// Lives in its own file (no other runtime deps) so client components can
// value-import it without pulling in lib/services/portal.ts (which imports
// prisma + the email infrastructure, neither safe in client bundles).
//
// Same codes as lib/chase/chaseable-milestones.ts CLIENT_CHASE_EXCLUDE today
// but kept SEPARATE because the two concepts could diverge in future:
//   - CLIENT_CHASE_EXCLUDE = "we don't email clients about these"
//   - PORTAL_AGENT_ONLY_CODES = "clients can't confirm these from the portal"

export const PORTAL_AGENT_ONLY_CODES: ReadonlySet<string> = new Set([
  "VM18", "PM25",
  "VM19", "PM26",
  "VM20", "PM27",
]);

export function isPortalAgentOnly(code: string): boolean {
  return PORTAL_AGENT_ONLY_CODES.has(code);
}

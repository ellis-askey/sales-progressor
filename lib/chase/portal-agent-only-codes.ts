// Client-safe constant: milestone codes that clients are HARD-BLOCKED from
// confirming via the portal. B1 of the client-chase arc (Sub-arc B).
//
// These are the three bilateral pairs plus the enquiries-satisfied pair:
//   - VM18 / PM25  — ready-to-exchange gates
//   - VM19 / PM26  — exchange
//   - VM20 / PM27  — completion
//   - PM20 / VM21  — "all enquiries satisfied" (a solicitor's legal judgement;
//     it opens the exchange gate, so a client must never self-confirm it).
//     NB: "enquiries raised" (PM14) and "received" (VM10) are DELIBERATELY not
//     here — a buyer/seller CAN confirm those, since their solicitor often
//     tells them before telling us.
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
  "PM20", "VM21",
]);

export function isPortalAgentOnly(code: string): boolean {
  return PORTAL_AGENT_ONLY_CODES.has(code);
}

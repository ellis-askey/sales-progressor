// lib/chase/chaseable-milestones.ts
//
// Closes Sub-arc A of the client-chase arc (foundation, A6).
//
// Curated allowlist deciding which milestone codes the automated client-
// chase pipeline (Sub-arc B) is permitted to email clients about. The list
// is defined by EXCLUSION rather than inclusion: by default every
// MilestoneDefinition.code is chaseable; six specific codes are excluded.
//
// Excluded: the three bilateral pairs (gates, exchange, completion). These
// are events where both sides must confirm simultaneously in the real world
// — they're agent-orchestrated and not appropriate for client digest emails.
//   - VM18 / PM25  — ready-to-exchange gates
//   - VM19 / PM26  — exchange
//   - VM20 / PM27  — completion
//
// Note: this is a CHASE-EMAIL exclusion only. Whether a client can navigate
// to their portal and self-confirm these six codes is a separate question
// (see the Sub-arc B planning agenda in docs/active/client-chase-discovery.md).
//
// No callers in Sub-arc A. Sub-arc B's chase pipeline imports
// isClientChaseable as the first filter when assembling the digest payload.

export const CLIENT_CHASE_EXCLUDE: ReadonlySet<string> = new Set([
  // Ready-to-exchange gates — automatically unlocked when same-side
  // blocksExchange milestones complete; not a client-confirmable real-world
  // action.
  "VM18", "PM25",
  // Exchange — bilateral event; agent-orchestrated.
  "VM19", "PM26",
  // Completion — bilateral event; agent-orchestrated.
  "VM20", "PM27",
]);

export function isClientChaseable(code: string): boolean {
  return !CLIENT_CHASE_EXCLUDE.has(code);
}

// Locked copy for the six bilateral milestones that clients are HARD-BLOCKED
// from confirming via the portal. Parallel to PORTAL_AGENT_ONLY_CODES in
// portal-agent-only-codes.ts (B1) — same six codes, plus the explanatory
// strings the respond page renders when a client lands on one (forwarded
// link, stale bookmark, manual URL).
//
// Surface 3 of the pre-B7 copy batch. House style: calm, plain English,
// no em-dashes, no alarm. The "We'll mark this here" closer answers the
// implicit "so what do I do?" with "nothing, handled." Voice is always
// first-person plural — the agency itself is the sender of the portal,
// whether a director / negotiator runs it or the Sales Progressor team
// is progressing on their behalf.
//
// These should rarely render: A6's allowlist filters bilateral codes out
// of the chase pipeline AND the respond-page loader filters them out of
// the displayed list. The strings only surface if a client somehow
// triggers the server action against one of these codes — defensive UX.

export const PORTAL_AGENT_ONLY_COPY: Record<string, string> = {
  // ─── Ready-to-exchange (one-sided gate, NOT the bilateral event) ──────
  VM18:
    "Ready-to-exchange means your solicitor has confirmed to us that they're set to exchange contracts on your side. Exchange itself happens once the buyer's solicitor confirms the same. We'll mark this when your solicitor confirms it.",
  PM25:
    "Ready-to-exchange means your solicitor has confirmed to us that they're set to exchange contracts on your side. Exchange itself happens once the seller's solicitor confirms the same. We'll mark this when your solicitor confirms it.",

  // ─── Exchange (the legally binding moment) ──────────────────────────
  VM19:
    "Exchange is the point where the sale becomes legally binding. Your solicitor and the buyer's solicitor confirm everything is agreed, and from then on neither side can pull out without big consequences. We'll mark this here once it's happened.",
  PM26:
    "Exchange is the point where the sale becomes legally binding. Your solicitor and the seller's solicitor confirm everything is agreed, and from then on neither side can pull out without big consequences. We'll mark this here once it's happened.",

  // ─── Completion (asymmetric: each side gets the line that fits them) ─
  VM20:
    "Completion is the day the sale finishes. The buyer's solicitor sends the money over to your solicitor, and the keys hand over to the new owner. We'll mark this here once it's done.",
  PM27:
    "Completion is the day you officially own the property. Your solicitor sends the money over to the seller's solicitor, and the keys become yours. We'll mark this here once it's done.",
};

// Generic fallback for any code in PORTAL_AGENT_ONLY_CODES but not in this
// map (unreachable today — both maps are populated for the same six codes
// — but defends against future codes being added to the SET without a
// matching COPY entry).
export const PORTAL_AGENT_ONLY_COPY_FALLBACK =
  "We handle this step. Nothing for you to do here.";

export function getPortalAgentOnlyCopy(code: string): string {
  return PORTAL_AGENT_ONLY_COPY[code] ?? PORTAL_AGENT_ONLY_COPY_FALLBACK;
}

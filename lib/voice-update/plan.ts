// Voice-note → plan: shared types + the pure prerequisite-expansion logic
// (docs/active/log-an-update/SPEC.md). When the agent's note implies a late step
// is done ("the offer's accepted"), the earlier steps that MUST be true for that
// to hold (its prerequisite chain) are offered alongside it — but only the ones
// not already done, and never a step that doesn't apply to this file.

import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";

export type MilestoneSideLite = "vendor" | "purchaser";

// The slimmed milestone state we need from the file to build a plan.
export type MilestoneRowLite = {
  code: string;
  name: string;
  side: MilestoneSideLite;
  orderIndex: number;
  eventDateRequired: boolean;
  isComplete: boolean;
  isNotRequired: boolean;
};

export type PlanMilestone = {
  code: string;
  name: string;
  side: MilestoneSideLite;
  needsEventDate: boolean; // PM6 valuation / PM9 survey ask for a date (as on the Steps tab)
  isPrereq: boolean; // included because it's a prerequisite of a detected step, not itself named
};

export type VoiceEnquiry = {
  flipsCourtTo: "seller_solicitor" | "buyer_solicitor";
  label: string; // human line for the review row
} | null;

export type VoicePlan = {
  milestones: PlanMilestone[];
  enquiry: VoiceEnquiry;
  todos: { title: string; dueDate: string | null }[];
  drafts: { sellerMessage: string; buyerMessage: string; internalNote: string };
  transcript: string;
};

// BFS the prerequisite graph for every upstream code of `startCode` (excludes
// the start itself). Map is injectable for testing.
export function collectPrereqCodes(
  startCode: string,
  prereqs: Record<string, string[]> = DIRECT_PREREQUISITES,
): string[] {
  const visited = new Set<string>();
  const queue = [startCode];
  while (queue.length > 0) {
    const code = queue.shift() as string;
    for (const p of prereqs[code] ?? []) {
      if (!visited.has(p)) {
        visited.add(p);
        queue.push(p);
      }
    }
  }
  return Array.from(visited);
}

// Given the codes the AI detected as "now done" + the file's milestone states,
// return the ordered, de-duped set of steps to offer: each detected code plus
// its incomplete prerequisites, dropping anything already complete or
// not-applicable to this file. Steps flagged isPrereq were pulled in by the chain.
export function buildMilestonePlan(
  detectedCodes: string[],
  rows: MilestoneRowLite[],
  prereqs: Record<string, string[]> = DIRECT_PREREQUISITES,
): PlanMilestone[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const include = new Map<string, boolean>(); // code -> isPrereq

  for (const code of detectedCodes) {
    const row = byCode.get(code);
    // Skip codes that aren't on this file at all, are already done, or don't apply.
    if (!row || row.isComplete || row.isNotRequired) continue;
    if (!include.has(code)) include.set(code, false); // directly detected
    for (const pre of collectPrereqCodes(code, prereqs)) {
      const preRow = byCode.get(pre);
      if (!preRow || preRow.isComplete || preRow.isNotRequired) continue; // only incomplete, applicable prereqs
      if (!include.has(pre)) include.set(pre, true); // pulled in as a prerequisite
      else if (detectedCodes.includes(pre)) include.set(pre, false); // also directly named
    }
  }

  return Array.from(include.entries())
    .map(([code, isPrereq]) => {
      const row = byCode.get(code) as MilestoneRowLite;
      return {
        code,
        name: row.name,
        side: row.side,
        needsEventDate: row.eventDateRequired,
        isPrereq,
      };
    })
    .sort((a, b) => (byCode.get(a.code)!.orderIndex - byCode.get(b.code)!.orderIndex));
}

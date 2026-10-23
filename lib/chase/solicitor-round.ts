// Round-scoping for the solicitor chase counter (critique #299).
//
// SolicitorChaseState is keyed (transactionId, side, milestoneCode) with NO
// buyerRoundId — so on a RELISTED file one row can span two buyers. The client
// counter is already buyer-tagged; this is the solicitor equivalent, done by a
// date boundary at the active buyer round's start (the relist moment) because the
// row has no round column. A purchaser-side chase dated BEFORE the current buyer
// began belongs to the previous buyer and must not count or show. Vendor-side
// chases are unaffected by a buyer relist (file-level), so they pass through.
//
// Pure function — safe to import anywhere (timeline, reminders, hub).

export type SolChaseStateLike = {
  chaseCount: number;
  firstChasedAt: Date | null;
  lastChasedAt: Date | null;
  status: string;
};

export type SolRoundScoped = {
  count: number;            // chases that belong to the CURRENT buyer
  firstAt: Date | null;     // first current-buyer chase
  lastAt: Date | null;      // last current-buyer chase
  stale: boolean;           // true when the row carried previous-buyer chases we dropped
};

// roundStart = the active BuyerRound.createdAt (null when the file has no active
// round — then nothing is scoped and the raw counter is used).
export function solChasesInRound(
  sol: SolChaseStateLike | null | undefined,
  side: "vendor" | "purchaser",
  roundStart: Date | null,
): SolRoundScoped {
  if (!sol) return { count: 0, firstAt: null, lastAt: null, stale: false };
  if (side === "vendor" || !roundStart) {
    return { count: sol.chaseCount, firstAt: sol.firstChasedAt, lastAt: sol.lastChasedAt, stale: false };
  }
  const inRound = (d: Date | null): d is Date => d != null && d.getTime() >= roundStart.getTime();
  // First chase is already in-round → the whole row belongs to this buyer.
  if (inRound(sol.firstChasedAt)) {
    return { count: sol.chaseCount, firstAt: sol.firstChasedAt, lastAt: sol.lastChasedAt, stale: false };
  }
  // First chase predates this buyer. We only have first + last dates, so the
  // honest in-round view is the LAST chase if it's in-round (one), else none.
  // (Contaminated rows only exist on files relisted before the auto-reset shipped
  // — in practice a single old chase + a single new one, so this is exact.)
  if (inRound(sol.lastChasedAt)) {
    return { count: 1, firstAt: sol.lastChasedAt, lastAt: sol.lastChasedAt, stale: true };
  }
  return { count: 0, firstAt: null, lastAt: null, stale: true };
}

// Does this solicitor row carry chases from a PREVIOUS buyer? Used by the sender
// to self-heal (clear) the stale row so chasing resumes correctly for the new
// buyer — the row has no round tag, so a stale firstChasedAt is the only signal.
export function solRowIsStale(
  sol: { firstChasedAt: Date | null } | null | undefined,
  side: "vendor" | "purchaser",
  roundStart: Date | null,
): boolean {
  if (!sol || side === "vendor" || !roundStart || sol.firstChasedAt == null) return false;
  return sol.firstChasedAt.getTime() < roundStart.getTime();
}

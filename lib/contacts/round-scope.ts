// Active-buyer-round scoping for a flat contacts list (critique #12 follow-up).
//
// A relisted file keeps its archived previous buyer(s) as Contact rows carrying
// the OLD round's buyerRoundId, alongside the new buyer on the active round.
// Any surface that names or emails "the buyer" must filter to the active round
// or it leaks the old buyer (mixed names, or worse — emailing a past buyer).
//
// Pure + dependency-free so it can be imported anywhere (chases, completion
// pack, enquiries, notifications) with no import-cycle risk. The stateful,
// mutating equivalent for whole-transaction reads is scopeContactsToActiveRound
// in lib/services/transactions.ts.

export function isActiveRoundContact(
  c: { roleType: string; buyerRoundId: string | null },
  activeBuyerRoundId: string | null,
): boolean {
  if (c.roleType !== "purchaser") return true; // vendors / others are file-level
  if (activeBuyerRoundId === null) return true; // defensive: no active round → keep all
  if (c.buyerRoundId === null) return true; // legacy / pre-rounds contact → keep
  return c.buyerRoundId === activeBuyerRoundId;
}

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

export type EmailCoverageContact = { roleType: string; email: string | null; buyerRoundId: string | null };

// Which client sides (seller / buyer) can't be reached by email at all.
//
// A side counts as a gap ONLY when it has active-round contacts and NONE of
// them has an email — the chase engine then has no address to send to. A
// household where one partner has an email IS reachable (the chase lands on the
// partner who has one), so a co-contact lacking their own address is NOT a gap.
// This is the per-SIDE rule; the old per-CONTACT check (`contacts.some(no
// email)`) wrongly flagged every couple with one address between them.
//
// Round-scoped: only the active buyer round is considered, so an archived
// previous buyer never drags a relisted file into "missing email".
export function sidesWithNoEmail(
  contacts: EmailCoverageContact[],
  activeBuyerRoundId: string | null,
): ("vendor" | "purchaser")[] {
  const out: ("vendor" | "purchaser")[] = [];
  for (const side of ["vendor", "purchaser"] as const) {
    const onSide = contacts.filter((c) => c.roleType === side && isActiveRoundContact(c, activeBuyerRoundId));
    if (onSide.length === 0) continue; // no one on this side → nothing to chase, not a gap
    const reachable = onSide.some((c) => !!c.email && c.email.trim() !== "");
    if (!reachable) out.push(side);
  }
  return out;
}

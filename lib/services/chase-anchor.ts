// Pure chase-anchor computation, extracted from client-chase-cron.ts so it can
// be unit-tested without dragging in the cron's heavy dependency chain
// (prisma / next-auth / email). No imports on purpose — just Date maths.
//
// Resolves the date a chase rule's silence clock counts from. Mirrors the agent
// reminder engine's logic: eventDate when useEventDate=true OR reconciledAtClaim
// (the claim-day completedAt is misleading for backdated work). Returns null if
// the rule can't be anchored today (anchor not yet confirmed, or reconciled-at-
// claim with no eventDate) — callers skip those rules until the anchor lands.
//
// Migrated files (Migrate Sale): a self-service import keeps each step's REAL
// historical completedAt for accurate dates on the file, so the anchor is
// FLOORED to migratedAt (the import instant). Without the floor every already-
// done step would read as overdue the moment the file lands and the client/
// solicitor would be chased about things that happened before the sale was ever
// with us. Flooring means historical steps never chase, while a genuinely-
// outstanding step chases forward from import. Legacy admin-migrated files
// (migratedAt null) keep the prior completedAt-anchored behaviour; ordinary
// sales (isMigrated false) are untouched.

export type RuleAnchorInput = {
  rule: { anchorMilestoneId: string | null; useEventDate: boolean };
  transaction: { createdAt: Date; isMigrated?: boolean; migratedAt?: Date | null };
  anchorCompletion: {
    state: string;
    completedAt: Date | null;
    eventDate: Date | null;
    reconciledAtClaim: boolean;
  } | null;
};

export function computeAnchorDate(input: RuleAnchorInput): Date | null {
  const { rule, transaction, anchorCompletion } = input;
  const migratedFloor = transaction.isMigrated ? (transaction.migratedAt ?? null) : null;
  const applyFloor = (d: Date | null): Date | null => {
    if (!d || !migratedFloor) return d;
    return d.getTime() < migratedFloor.getTime() ? migratedFloor : d;
  };
  if (!rule.anchorMilestoneId) {
    // No anchor → use transaction createdAt as the silence-clock base.
    return applyFloor(transaction.createdAt);
  }
  if (!anchorCompletion || anchorCompletion.state !== "complete") return null;
  if (transaction.isMigrated) {
    return applyFloor(anchorCompletion.completedAt ?? transaction.createdAt);
  }
  if (anchorCompletion.reconciledAtClaim) {
    return anchorCompletion.eventDate ?? null;
  }
  if (rule.useEventDate && anchorCompletion.eventDate) {
    return anchorCompletion.eventDate;
  }
  return anchorCompletion.completedAt ?? transaction.createdAt;
}

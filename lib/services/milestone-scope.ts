// lib/services/milestone-scope.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY-LOAD-BEARING — DO NOT BYPASS
// ─────────────────────────────────────────────────────────────────────────────
//
// The portal cross-round-leak protection rests on every MilestoneCompletion
// read going through this helper. After a relist a transaction has TWO sets
// of purchaser milestone rows on the same file:
//
//   • The archived round's PMs (the previous buyer)
//   • The active round's PMs   (the new buyer)
//
// A read that uses a raw `where: { transactionId }` clause without a
// buyerRoundId filter will return BOTH sets. The new buyer's portal would
// then see the old buyer's progress as if it were their own. That is the
// privacy bug Phase 1 exists to prevent.
//
// Every MilestoneCompletion read, AND every nested include/select on a
// PropertyTransaction's milestoneCompletions, MUST pass an explicit scope
// through this helper. Forcing the scope at the call site is the point of
// the design — there is no default, and there is no helper-less escape
// hatch. A reader who needs an unfiltered view goes through
// allRoundsForAudit() and that name is what reviewers grep for.
//
// Vendor-side milestones (VM*) live at file level (buyerRoundId IS NULL) and
// are SHARED across rounds — they describe the seller, not the buyer, and
// persist when a buyer falls through. Purchaser-side milestones (PM*) are
// per-round.
//
// PM12-depends-on-VM9 (the only cross-side prereq) is first-class in
// forRound(): a single query reads both VM9 (file-level) and PM12 (per-round)
// via the OR clause emitted by milestoneScopeWhere.
//
// See also: docs/active/relist-feature/ (Phase 1 plan).

import type { Prisma } from "@prisma/client";

// Tagged scope. Three legitimate intents, no default. Forcing the choice at
// every call site is what keeps the privacy invariant audit-able.
//
//   forRound(roundId, transactionId)  — the bread-and-butter scope for every
//                                       agent + portal + engine read. Returns
//                                       vendor file-level rows AND that
//                                       round's purchaser rows together.
//                                       Use the active round id for live
//                                       reads; an archived round id for the
//                                       archived-round view; null when the
//                                       transaction is in the gap window
//                                       with no round assigned (degrades to
//                                       vendor-only and warns loudly so the
//                                       gap surfaces in logs).
//
//   vendorOnly()                      — vendor-side milestone view only.
//                                       Use when you have decided you do
//                                       NOT want any round's purchaser rows
//                                       (e.g. a vendor-side analytics
//                                       widget). Different intent from
//                                       forRound(null) — see the comment
//                                       on `kind: "forRound"` below.
//
//   allRoundsForAudit()               — every row, no filter. The dangerous
//                                       one. Audit logs, archive timelines,
//                                       admin/cross-round migration tooling.
//                                       NEVER for a live agent or portal
//                                       read; the name shouts at reviewers
//                                       so a casual caller pauses.
export type MilestoneScope =
  // forRound(null) is structurally identical to vendorOnly() — both compile
  // to `buyerRoundId IS NULL`. The difference is INTENT, surfaced at the
  // call site and recorded on the scope object:
  //
  //   • forRound(tx.activeBuyerRoundId, tx.id) documents "I wanted the
  //     active round's view; gracefully degrade if it's missing." If the
  //     null path triggers, we WARN with the transactionId so the gap
  //     surfaces in production logs.
  //
  //   • vendorOnly() documents "I deliberately want vendor only, even
  //     when a round exists." Silent — no warning, because no gap.
  //
  // Keeping them as separate kinds lets future readers tell the two apart
  // by grep, and lets monitoring distinguish "we expected a round" from
  // "we deliberately scoped out the rounds."
  | { readonly kind: "forRound"; readonly roundId: string | null; readonly transactionId: string }
  | { readonly kind: "vendorOnly" }
  | { readonly kind: "allRoundsForAudit" };

// Factory: vendor file-level + this round's purchaser rows. Pass `null` for
// the gap-file degradation case; the helper falls back to vendor-only AND
// logs a structured warning with the transactionId. After commit 3 + the
// re-run of the Phase 0 backfill the null path is theoretical, so the log
// stays silent in practice — if it ever fires it's an orphaned file we want
// to know about, not silently tolerate.
export function forRound(roundId: string | null, transactionId: string): MilestoneScope {
  return { kind: "forRound", roundId, transactionId };
}

// Factory: vendor (file-level) rows only. Purchaser rows excluded.
export function vendorOnly(): MilestoneScope {
  return { kind: "vendorOnly" };
}

// Factory: every row regardless of round. Use for audit/archive/admin
// surfaces only — the unfiltered scope is the dangerous one. Live agent
// and portal reads must NEVER use this.
export function allRoundsForAudit(): MilestoneScope {
  return { kind: "allRoundsForAudit" };
}

// Compose a scope into a Prisma `where` fragment. Spread (or AND) into
// any MilestoneCompletion query — top-level (prisma.milestoneCompletion.*)
// or nested (transaction.findFirst({ include: { milestoneCompletions: {
// where: ... } } })). Both shapes accept the same WhereInput.
//
//   const completions = await prisma.milestoneCompletion.findMany({
//     where: {
//       transactionId,
//       ...milestoneScopeWhere(forRound(tx.activeBuyerRoundId, tx.id)),
//       state: "complete",
//     },
//   });
//
//   const tx = await prisma.propertyTransaction.findFirst({
//     where: { id: txId },
//     include: {
//       milestoneCompletions: {
//         where: milestoneScopeWhere(forRound(tx.activeBuyerRoundId, tx.id)),
//       },
//     },
//   });
export function milestoneScopeWhere(
  scope: MilestoneScope,
): Prisma.MilestoneCompletionWhereInput {
  switch (scope.kind) {
    case "forRound": {
      if (scope.roundId === null) {
        // Loud — this is the gap-file path. After commit 3 + backfill re-run
        // it should never fire in production. If it does, surface the txn so
        // an operator can investigate orphaning.
        console.warn(
          `[milestone-scope] forRound(null) triggered — gap file detected, degrading to vendor-only. transactionId=${scope.transactionId}`,
        );
        return { buyerRoundId: null };
      }
      // The combined cross-side case (vendor file-level OR active-round
      // purchaser) — first-class so the PM12-depends-on-VM9 prereq read
      // works without ad-hoc assembly at the call site.
      return {
        OR: [{ buyerRoundId: null }, { buyerRoundId: scope.roundId }],
      };
    }
    case "vendorOnly":
      return { buyerRoundId: null };
    case "allRoundsForAudit":
      return {};
  }
}

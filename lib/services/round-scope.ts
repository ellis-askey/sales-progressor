// Phase-3 (cross-tx aggregate restructure) — shared round-scope helpers.
//
// The "(a)-CLASS" problem: Prisma's nested `where` inside a cross-tx
// `propertyTransaction.findMany` / `.count` / `.groupBy` cannot reference
// the parent row's `activeBuyerRoundId`. So aggregates over per-round-
// attributed models (MilestoneCompletion, Contact, ChaseTask,
// OutboundMessage, PortalMessage) include rows from any round on the
// file — active or archived — inflating counts on relisted files.
//
// The fix is a two-step pattern:
//   1. Pre-load the set of `activeBuyerRoundId` values across the
//      in-scope txs.
//   2. Feed that set into an OR filter on the cross-tx aggregate:
//        WHERE buyerRoundId IS NULL OR buyerRoundId IN [active set]
//
// BuyerRound ids are globally unique cuids, so a row's
// `buyerRoundId IN [active set]` is exactly equivalent to "buyerRoundId
// === its own tx's activeBuyerRoundId" — the desired scope.
//
// Reference pattern: lib/services/reminders.ts:295-310's raw SQL OR
// clause for the work-queue reminder-log scoping (shipped pre-Phase-3
// as the prototype for this restructure).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// The OR clause for any model with a nullable buyerRoundId column.
//
// Return type is intentionally NOT a named Prisma type — TS infers a
// structural union (`{ buyerRoundId: null } | { buyerRoundId: { in:
// string[] } }`) that's assignable to MilestoneCompletionWhereInput,
// ChaseTaskWhereInput, OutboundMessageWhereInput, PortalMessageWhereInput,
// and any other model with the same shape. Adding a named return type
// would lock the helper to one Prisma model.
//
// Empty activeRoundIds → only file-level (NULL) rows. Defensive for the
// empty-scope case where every in-scope tx has activeBuyerRoundId IS NULL.
export function roundScopedOR(activeRoundIds: string[]) {
  return [
    { buyerRoundId: null },
    ...(activeRoundIds.length > 0 ? [{ buyerRoundId: { in: activeRoundIds } }] : []),
  ];
}

// The OR clause for Contact, which also lets non-purchaser roles pass
// through unconditionally (vendor / solicitor / broker / other are
// file-level by design across all sales).
export function contactRoundScopedOR(activeRoundIds: string[]) {
  return [
    { roleType: { not: "purchaser" as const } },
    { buyerRoundId: null },
    ...(activeRoundIds.length > 0 ? [{ buyerRoundId: { in: activeRoundIds } }] : []),
  ];
}

// Pre-load active buyer round ids for an arbitrary PropertyTransaction
// where clause. Returns the set of non-null values across in-scope txs.
export async function loadActiveRoundIds(
  whereClause: Prisma.PropertyTransactionWhereInput,
): Promise<string[]> {
  const rows = await prisma.propertyTransaction.findMany({
    where: whereClause,
    select: { activeBuyerRoundId: true },
  });
  return rows.map((r) => r.activeBuyerRoundId).filter((id): id is string => id !== null);
}

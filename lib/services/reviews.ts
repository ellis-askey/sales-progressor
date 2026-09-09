// lib/services/reviews.ts
//
// "Reviews due" — dated "come back to this file on X" items surfaced in a
// dedicated section on /agent/to-do. Two feeders, ONE section:
//
//   1. Holds with a return date. Read straight from TransactionHoldPeriod
//      (single source of truth). This covers every "wait until a date"
//      situation the app already models: a manual on-hold with a return
//      date, a chain-collapse "we'll wait N weeks" response (the chain
//      respond route puts the file on hold with the chosen date), and a
//      remarketing pause. NOTHING is duplicated into ManualTask — the hold
//      row IS the review, so there is no sync to keep and no drift.
//
//   2. Manual reviews. ManualTask rows flagged isReview=true (the hand-typed
//      "check on this on <date>" an agent sets from a file's To-Do tab).
//
// Visibility follows file access scope exactly like getExpiredHolds:
//   agency  → own self-managed files only (outsourced holds belong to the SP team)
//   assigned→ the sales_progressor's assigned files
//   all     → admin / superadmin see everything.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AccessScope } from "@/lib/security/access-scope";
import { toUKDateStr } from "@/lib/utils";

// Origin of a hold-based review, derived from the free-text hold reason so the
// UI can tag WHY the file is parked (chain collapse vs remarketing vs a plain
// hold) without a schema change. The chain respond route writes the canonical
// reason strings this keys off ("...chain to reform" / "...back on the market").
export type ReviewOrigin = "hold" | "chain_wait" | "remarketing";

export type ReviewItem =
  | {
      kind: "hold";
      key: string;
      transactionId: string;
      address: string;
      reviewDate: Date;
      reason: string | null;
      origin: ReviewOrigin;
      startedAt: Date;
      placedByName: string | null;
    }
  | {
      kind: "manual";
      key: string;
      id: string;
      transactionId: string | null;
      address: string | null;
      title: string;
      notes: string | null;
      reviewDate: Date | null;
      status: "open" | "done";
    };

export type ReviewsResult = {
  /** Open reviews (all holds + open manual reviews), soonest-due first. */
  items: ReviewItem[];
  /** Completed manual reviews, for the collapsed "Done" tail. */
  done: ReviewItem[];
};

function originFromReason(reason: string | null): ReviewOrigin {
  if (!reason) return "hold";
  const r = reason.toLowerCase();
  if (r.includes("chain")) return "chain_wait";
  if (r.includes("market")) return "remarketing";
  return "hold";
}

// The transaction where-clause for hold-based reviews. Mirrors getExpiredHolds'
// scoping rule: agency viewers only see holds on files they progress themselves;
// internal staff see their assigned / all files.
function holdTxFilter(scope: AccessScope): Prisma.PropertyTransactionWhereInput {
  if (scope.kind === "all") return { status: "on_hold" };
  if (scope.kind === "assigned") return { status: "on_hold", assignedUserId: scope.userId };
  return { status: "on_hold", serviceType: "self_managed", agencyId: { in: scope.agencyIds } };
}

// The transaction where-clause for manual reviews. A review is always attached
// to a file, so we scope through the relation (which also forces transactionId
// to be non-null). No serviceType restriction here — a review the agent
// deliberately set on any of their files is theirs to see.
function reviewTxFilter(scope: AccessScope): Prisma.PropertyTransactionWhereInput {
  if (scope.kind === "all") return {};
  if (scope.kind === "assigned") return { assignedUserId: scope.userId };
  return { agencyId: { in: scope.agencyIds } };
}

export async function listReviews(scope: AccessScope): Promise<ReviewsResult> {
  const [holdRows, manualRows] = await Promise.all([
    prisma.transactionHoldPeriod.findMany({
      where: {
        endedAt: null,
        plannedEndAt: { not: null },
        transaction: holdTxFilter(scope),
      },
      select: {
        transactionId: true,
        plannedEndAt: true,
        startedAt: true,
        reason: true,
        startedBy: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
      },
      orderBy: { plannedEndAt: "asc" },
    }),
    prisma.manualTask.findMany({
      where: { isReview: true, transaction: reviewTxFilter(scope) },
      select: {
        id: true,
        transactionId: true,
        title: true,
        notes: true,
        dueDate: true,
        status: true,
        transaction: { select: { propertyAddress: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const holdItems: ReviewItem[] = holdRows
    .filter((r) => r.plannedEndAt !== null)
    .map((r) => ({
      kind: "hold",
      key: `hold-${r.transactionId}`,
      transactionId: r.transactionId,
      address: r.transaction.propertyAddress,
      reviewDate: r.plannedEndAt as Date,
      reason: r.reason,
      origin: originFromReason(r.reason),
      startedAt: r.startedAt,
      placedByName: r.startedBy?.name ?? null,
    }));

  const manualOpen: ReviewItem[] = [];
  const manualDone: ReviewItem[] = [];
  for (const t of manualRows) {
    const item: ReviewItem = {
      kind: "manual",
      key: `task-${t.id}`,
      id: t.id,
      transactionId: t.transactionId,
      address: t.transaction?.propertyAddress ?? null,
      title: t.title,
      notes: t.notes,
      reviewDate: t.dueDate,
      status: t.status,
    };
    (t.status === "done" ? manualDone : manualOpen).push(item);
  }

  const items = [...holdItems, ...manualOpen].sort((a, b) => {
    const ad = a.reviewDate ? a.reviewDate.getTime() : Infinity;
    const bd = b.reviewDate ? b.reviewDate.getTime() : Infinity;
    return ad - bd;
  });

  return { items, done: manualDone };
}

/**
 * Count of reviews that are due today or overdue (holds past their return date,
 * plus open manual reviews due today/earlier). Feeds the To-Do nav badge and
 * the hub's "Reviews due" pointer.
 */
export async function countReviewsDue(scope: AccessScope): Promise<number> {
  const { items } = await listReviews(scope);
  const todayStr = toUKDateStr(new Date());
  return items.filter((i) => i.reviewDate && toUKDateStr(i.reviewDate) <= todayStr).length;
}

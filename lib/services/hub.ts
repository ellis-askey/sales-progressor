import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AgentVisibility } from "./agent";
import type { FlagKind } from "./problem-detection";
import { toUKDateStr } from "@/lib/utils";
import { classifyReminder } from "@/lib/reminders/classify";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";

// ─────────────────────────────────────────────────────────────────────────────
// PHASE-3 (cross-tx aggregate restructure, 2026-06-05) — (a)-CLASS RESOLVED.
//
// Every cross-tx `milestoneCompletions: { some/none: ... }` filter in this
// file is now augmented with `OR: roundScopedOR(activeRoundIds)` — the
// two-step pattern from lib/services/round-scope.ts. The per-function
// `loadActiveRoundIds(txWhere)` pre-load establishes the set of valid
// active round ids; the OR clause then scopes each MC nested filter to
// (file-level vendor rows) UNION (rows whose buyerRoundId matches an
// in-scope tx's activeBuyerRoundId).
//
// Pre-Phase-3 (the original (a)-CLASS): the archived-round PM26/VM19/
// PM27/VM20 of a relisted file could match these filters, inflating
// "stalled" / "exchanging this week" / closing-this-month counts. The
// per-site comment `// PHASE 1 4d (a)-CLASS` is retained on the lines
// where the OR was added so a grep over the file finds every restructured
// site at a glance.
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<FlagKind, "overdue" | "watch" | "attention"> = {
  chase_unanswered:          "overdue",
  exchange_approaching_gaps: "overdue",
  long_silence:              "watch",
  milestone_stalled:         "watch",
  on_hold_extended:          "watch",
  no_portal_activity:        "attention",
  overdue_milestone:         "attention",
};

// Matches the established pattern from listTransactions (dashboard)
function buildTxWhere(vis: AgentVisibility): Prisma.PropertyTransactionWhereInput {
  // Internal staff paths — checked first; agent callers have internalMode undefined and skip these.
  // admin_all: internal team only touches outsourced files. Filter added
  // 2026-07-06 alongside sibling bugs in reminders.ts + work-queue.ts.
  if (vis.internalMode === "admin_all") return { serviceType: "outsourced" };
  if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId };
  // Agent paths (director / negotiator) — unchanged.
  if (vis.seeAll) {
    return vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId, agentUserId: { not: null } };
  }
  return { agencyId: vis.agencyId, agentUserId: vis.userId };
}

// Nested filter for relations (no agencyId — already on the parent model)
function buildTxNested(vis: AgentVisibility): Prisma.PropertyTransactionWhereInput {
  // Internal staff paths.
  if (vis.internalMode === "admin_all") return { serviceType: "outsourced" };
  if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId };
  // Agent paths — unchanged.
  if (vis.seeAll) {
    return vis.firmName
      ? { agentUser: { firmName: vis.firmName } }
      : { agentUserId: { not: null } };
  }
  return { agentUserId: vis.userId };
}

// ── Pipeline stats ────────────────────────────────────────────────────────────

export async function getHubPipelineStats(vis: AgentVisibility) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const in30Days = new Date(now.getTime() + 30 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
  const txWhere = buildTxWhere(vis);
  // Phase-3: pre-load active round ids for every cross-tx MC filter below.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const [
    activeCount,
    exchangingSoon,
    pipelineFiles,
    newThisMonth,
    // Coming up
    exchangingThisWeekTxs,
    completingThisWeekTxs,
    closingThisMonthTxs,
    // Stalled
    stalledTxs,
  ] = await Promise.all([
    // ── Existing hero numbers ──────────────────────────────────────────────────
    prisma.propertyTransaction.count({
      where: { ...txWhere, status: "active" },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        status: "active",
        OR: [
          { expectedExchangeDate: { gte: now, lte: in30Days } },
          { overridePredictedDate: { gte: now, lte: in30Days } },
        ],
      },
    }),
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, status: "active" },
      select: { purchasePrice: true },
    }),
    prisma.propertyTransaction.count({
      where: { ...txWhere, createdAt: { gte: startOfMonth }, status: { not: "draft" } },
    }),

    // ── Coming up: exchanging this week ────────────────────────────────────────
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        expectedExchangeDate: { gte: now, lte: in7Days },
        NOT: {
          // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
      },
      select: { id: true },
    }),

    // ── Coming up: completing this week ───────────────────────────────────────
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        completionDate: { gte: now, lte: in7Days },
        NOT: {
          // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
      },
      select: { id: true },
    }),

    // ── Coming up: closing this month (purchase price sum) ────────────────────
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth },
        NOT: {
          // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
      },
      select: { purchasePrice: true },
    }),

    // ── Stalled: active, not exchanged, no genuine milestone in 14 days ───────
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        // No genuine (non-reconciled) completion in last 14 days
        // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
        milestoneCompletions: {
          none: {
            state: "complete",
            completedAt: { gte: fourteenDaysAgo },
            reconciledAtExchange: false,
            reconciledAtClaim: false,
            OR: roundScopedOR(activeRoundIds),
          },
        },
        AND: [
          {
            // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
            milestoneCompletions: {
              none: {
                state: "complete",
                reconciledAtClaim: true,
                eventDate: { gte: fourteenDaysAgo },
                OR: roundScopedOR(activeRoundIds),
              },
            },
          },
        ],
        NOT: {
          // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
      },
      select: { id: true },
    }),
  ]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const pipelineValuePence = pipelineFiles.reduce(
    (sum, tx) => sum + (tx.purchasePrice ?? 0), 0
  );

  const closingThisMonthTotal = closingThisMonthTxs.reduce(
    (sum, tx) => sum + (tx.purchasePrice ?? 0), 0
  );

  return {
    // Existing
    activeFiles: activeCount,
    exchangingSoon,
    pipelineValuePence,
    newThisMonth,
    // Coming up
    comingUp: {
      exchangingThisWeek: exchangingThisWeekTxs.length,
      completingThisWeek: completingThisWeekTxs.length,
      closingThisMonth: {
        total: closingThisMonthTotal, // in pence, same unit as pipelineValuePence
      },
    },
    // Stalled
    stalled: {
      count: stalledTxs.length,
      transactionIds: stalledTxs.map((t) => t.id).slice(0, 50),
    },
  };
}

// ── Hub filter helpers (used by /agent/transactions?filter=...) ──────────────

export type HubFilter = "exchanging-this-week" | "completing-this-week" | "closing-this-month" | "exchanging-next-30-days";

/**
 * Returns IDs of transactions matching a Hub "Coming up" filter.
 * Mirrors the exact where-clauses in getHubPipelineStats so the count
 * on the destination page equals the Hub strip count.
 */
export async function getHubFilteredIds(
  vis: AgentVisibility,
  filter: HubFilter
): Promise<string[]> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const in30Days = new Date(now.getTime() + 30 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const txWhere = buildTxWhere(vis);

  // Phase-3: same pre-load + OR scoping as getHubPipelineStats.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  let where: Prisma.PropertyTransactionWhereInput;

  if (filter === "exchanging-next-30-days") {
    where = {
      ...txWhere,
      status: "active",
      OR: [
        { expectedExchangeDate: { gte: now, lte: in30Days } },
        { overridePredictedDate: { gte: now, lte: in30Days } },
      ],
    };
  } else if (filter === "exchanging-this-week") {
    where = {
      ...txWhere,
      status: "active",
      expectedExchangeDate: { gte: now, lte: in7Days },
      NOT: {
        // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    };
  } else if (filter === "completing-this-week") {
    where = {
      ...txWhere,
      status: "active",
      completionDate: { gte: now, lte: in7Days },
      NOT: {
        // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    };
  } else {
    where = {
      ...txWhere,
      status: "active",
      expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth },
      NOT: {
        // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    };
  }

  const results = await prisma.propertyTransaction.findMany({ where, select: { id: true } });
  return results.map((r) => r.id);
}

/**
 * Returns IDs of active transactions exchanging within a specific calendar
 * month. Parallel to getHubFilteredIds but parameterised on year/month so the
 * ForecastStrip compact summary can drive per-month filtering via ?exchanging=YYYY-MM.
 *
 * The OR on expectedExchangeDate || overridePredictedDate mirrors getExchangeForecast
 * (lib/services/transactions.ts:286-289) so the pill count and the row count below
 * stay identical — that's the contract that makes the strip a credible filter.
 */
export async function getMonthExchangingIds(
  vis: AgentVisibility,
  year: number,
  month: number, // 0-indexed (matches ForecastMonth.month + JS Date convention)
): Promise<string[]> {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const txWhere = buildTxWhere(vis);

  // Phase-3 OR scope for the not-yet-exchanged check.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const where: Prisma.PropertyTransactionWhereInput = {
    ...txWhere,
    status: "active",
    OR: [
      { expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth } },
      { overridePredictedDate: { gte: startOfMonth, lte: endOfMonth } },
    ],
    NOT: {
      // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
          OR: roundScopedOR(activeRoundIds),
        },
      },
    },
  };

  const results = await prisma.propertyTransaction.findMany({ where, select: { id: true } });
  return results.map((r) => r.id);
}

// ── Flags with severity ───────────────────────────────────────────────────────

export type HubFlag = {
  id: string;
  kind: string;
  reason: string | null;
  detectedAt: Date;
  severity: "overdue" | "watch" | "attention";
  transaction: { id: string; propertyAddress: string; status: string };
};

export async function getHubFlags(vis: AgentVisibility): Promise<HubFlag[]> {
  const txNested = buildTxNested(vis);

  const flags = await prisma.transactionFlag.findMany({
    where: { agencyId: vis.agencyId, resolvedAt: null, transaction: txNested },
    orderBy: { detectedAt: "asc" },
    select: {
      id: true,
      kind: true,
      reason: true,
      detectedAt: true,
      transaction: { select: { id: true, propertyAddress: true, status: true } },
    },
  });

  return flags
    .map((f) => ({
      ...f,
      severity: SEVERITY_MAP[f.kind as FlagKind] ?? ("attention" as const),
    }))
    .sort((a, b) => {
      const order = { overdue: 0, watch: 1, attention: 2 };
      const diff = order[a.severity] - order[b.severity];
      return diff !== 0
        ? diff
        : new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
    });
}

// ── Momentum ──────────────────────────────────────────────────────────────────

// ── Hold-expired files ────────────────────────────────────────────────────
// Surfaces files that are on_hold AND the OPEN hold period's plannedEndAt
// has passed. Used by the hub's ExpiredHoldsCard — only renders when the
// list is non-empty, so the card disappears once everything's been
// actioned. Indefinite holds (plannedEndAt = NULL) never appear here.

export type ExpiredHoldItem = {
  transactionId: string;
  propertyAddress: string;
  plannedEndAt: Date;
  startedAt: Date;
  agencyName: string | null;
};

export async function getExpiredHolds(vis: AgentVisibility): Promise<ExpiredHoldItem[]> {
  const now = new Date();
  const txNested = buildTxNested(vis);

  // Open hold periods whose planned date has passed, on transactions still
  // in on_hold status. Filter the parent tx via the nested visibility clause
  // so internal staff see their assigned files and agents see their agency.
  const rows = await prisma.transactionHoldPeriod.findMany({
    where: {
      endedAt: null,
      plannedEndAt: { not: null, lt: now },
      transaction: { ...txNested, status: "on_hold" },
    },
    select: {
      transactionId: true,
      plannedEndAt: true,
      startedAt: true,
      transaction: {
        select: {
          propertyAddress: true,
          agency: { select: { name: true } },
        },
      },
    },
    orderBy: { plannedEndAt: "asc" },
  });

  return rows
    .filter((r) => r.plannedEndAt !== null)
    .map((r) => ({
      transactionId: r.transactionId,
      propertyAddress: r.transaction.propertyAddress,
      plannedEndAt: r.plannedEndAt as Date,
      startedAt: r.startedAt,
      agencyName: r.transaction.agency?.name ?? null,
    }));
}

export async function getHubMomentum(vis: AgentVisibility) {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const txWhere = buildTxWhere(vis);

  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const exchangeDefIds = exchangeDefs.map((d) => d.id);

  // PHASE 1 4d (a)-CLASS — see file banner. Cross-tx count of
  // exchange-marker completions; can over-count post-relist by
  // including an archived round's previous PM26/VM19 alongside the
  // new round's. exchangedAt-canonical principle (relist precondition)
  // prevents the practical case.
  //
  // 2026-07-03 correctness fix: count DISTINCT transactions with any
  // in-window exchange completion, not raw completion rows. Each
  // exchange writes two rows (VM19 vendor + PM26 purchaser) so counting
  // rows doubled the visible number.
  const activeRoundIds = await loadActiveRoundIds(txWhere);
  const [thisMonth, lastMonth] = await Promise.all([
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: exchangeDefIds },
            completedAt: { gte: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: exchangeDefIds },
            completedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
  ]);

  const percent =
    lastMonth > 0
      ? Math.min(200, Math.round((thisMonth / lastMonth) * 100))
      : null;

  return { thisMonth, lastMonth, percent };
}

// ── Wins card (hub polish PR 1) ──────────────────────────────────────────────
//
// Powers a "wins this month" card that always shows something, cascading
// through 4 tiers so brand-new accounts still see a positive signal:
//
//   Tier 1 — has exchanges this month → celebrate exchanges + completions +
//            fastest-exchange address
//   Tier 2 — has completions but no exchanges → completions + steps-confirmed
//   Tier 3 — no closings but activity → steps-confirmed-this-week + new files
//   Tier 4 — brand new account (no activity) → motivational fallback (client
//            renders the CTA; server just reports zeros)
//
// All counts are cross-tx and respect visibility scope (agent / progressor /
// admin). Uses the same VM19/PM26 (exchange) + VM20/PM27 (completion)
// milestone codes as getHubMomentum.

export type HubWins = {
  exchangesThisMonth: number;
  exchangesLastMonth: number;
  completionsThisMonth: number;
  completionsLastMonth: number;
  fastestExchangeDays: number | null;
  fastestExchangeAddress: string | null;
  stepsConfirmedThisWeek: number;
  newFilesThisMonth: number;
};

export async function getHubWins(vis: AgentVisibility): Promise<HubWins> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // "This week" = last 7 days rolling, not calendar week (matches the
  // "coming up" strip convention).
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const txWhere = buildTxWhere(vis);
  // PHASE 1 4d (a)-CLASS — pre-load active buyer round ids so every cross-tx
  // MilestoneCompletion filter below can scope to (file-level vendor rows)
  // UNION (rows on the active buyer round). Without this, a relisted file
  // would count its ARCHIVED-round exchange/completion milestones as
  // "wins this month" — inflating the Trophy tier for files whose current
  // buyer round hasn't exchanged yet. Same pattern as getHubMomentum.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const [exchangeDefs, completionDefs] = await Promise.all([
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM19", "PM26"] } },
      select: { id: true },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM20", "PM27"] } },
      select: { id: true },
    }),
  ]);
  const exchangeDefIds = exchangeDefs.map((d) => d.id);
  const completionDefIds = completionDefs.map((d) => d.id);

  const [
    exchangesThisMonth,
    exchangesLastMonth,
    completionsThisMonth,
    completionsLastMonth,
    fastestExchangeRows,
    stepsConfirmedThisWeek,
    newFilesThisMonth,
  ] = await Promise.all([
    // 2026-07-03 correctness fix: distinct-file counts, not row counts.
    // Each exchange writes two rows (VM19 vendor + PM26 purchaser) and
    // each completion writes two (VM20 + PM27). Counting rows doubled
    // every wins-card number. Same pattern as getHubPipelineStages.
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: exchangeDefIds },
            completedAt: { gte: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: exchangeDefIds },
            completedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: completionDefIds },
            completedAt: { gte: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: completionDefIds },
            completedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    }),
    // Fetch this month's exchange completions with their tx.createdAt so we can
    // compute days-to-exchange in JS and pick the fastest.
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: txWhere,
        milestoneDefinitionId: { in: exchangeDefIds },
        completedAt: { gte: startOfThisMonth },
        state: "complete",
        OR: roundScopedOR(activeRoundIds),
      },
      select: {
        completedAt: true,
        transaction: {
          select: { createdAt: true, propertyAddress: true },
        },
      },
    }),
    // Any milestone confirmed in the last 7 days — this is the "steps
    // confirmed" number used by tier 3 / secondary metric.
    prisma.milestoneCompletion.count({
      where: {
        transaction: txWhere,
        completedAt: { gte: sevenDaysAgo },
        state: "complete",
        OR: roundScopedOR(activeRoundIds),
      },
    }),
    // Files created this month — used by tier 3 secondary metric.
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        createdAt: { gte: startOfThisMonth },
      },
    }),
  ]);

  // Compute fastest-exchange days + address across this month's rows.
  let fastestExchangeDays: number | null = null;
  let fastestExchangeAddress: string | null = null;
  for (const row of fastestExchangeRows) {
    if (!row.completedAt || !row.transaction?.createdAt) continue;
    const days = Math.round(
      (row.completedAt.getTime() - row.transaction.createdAt.getTime()) /
        86400000,
    );
    if (days < 0) continue; // sanity
    if (fastestExchangeDays === null || days < fastestExchangeDays) {
      fastestExchangeDays = days;
      fastestExchangeAddress = row.transaction.propertyAddress;
    }
  }

  return {
    exchangesThisMonth,
    exchangesLastMonth,
    completionsThisMonth,
    completionsLastMonth,
    fastestExchangeDays,
    fastestExchangeAddress,
    stepsConfirmedThisWeek,
    newFilesThisMonth,
  };
}

// ── Pipeline at a glance — stage buckets (hub polish PR 2) ────────────────────
//
// Groups active files into 5 stages using the milestone engine's actual
// gate codes — NOT raw completion counts (which the initial cut used
// and got badly wrong, sending mid-legals files into "Ready"):
//
//   new         — active, fewer than 5 completions on the current round
//                  (fresh onboarding, no legal traction yet)
//   legals      — active, 5+ completions but either VM18 OR PM25 (both
//                  "ready to exchange" gates) NOT yet done
//   ready       — active, VM18 AND PM25 both done, VM19/PM26 NOT both done
//                  (actual "ready to exchange" per the milestone engine)
//   exchanging  — active, VM19 or PM26 completed, VM20+PM27 NOT both done
//                  (exchanged, awaiting completion)
//   completed   — status=completed AND completionDate in the current year
//
// A single tx only appears in one bucket; cascade is most-advanced downward
// (completed > exchanging > ready > legals > new).
//
// All milestoneCompletion filters carry roundScopedOR(activeRoundIds) so a
// relisted file doesn't classify on its archived round's completions.

// Per-stage stats surface into the hover popovers on PipelineAtAGlance.
// Every metric respects the same visibility scope as the bucket counts —
// director/negotiator see agency-scoped, sales_progressor sees assigned,
// admin sees everything. All null/optional fields mean "no data yet" for
// the empty-state renderer.
export type StageStatsNew = {
  count: number;
  oldestDays: number | null;
  newThisWeek: number;
  quietFiles: number;
};

export type StageStatsLegals = {
  count: number;
  vendorBlocking: number;
  buyerBlocking: number;
  bothBlocking: number;
  medianDaysInLegals: number | null;
};

export type StageStatsReady = {
  count: number;
  overdueToExchange: number;
  medianDaysToExchange: number | null;
  totalValueLocked: number | null;
};

export type StageStatsExchanging = {
  count: number;
  completingThisWeek: number;
  medianDaysSinceExchange: number | null;
  totalValueClosing: number | null;
};

export type StageStatsCompleted = {
  count: number;
  totalValueClosed: number | null;
  medianDaysToComplete: number | null;
  slaHitRate: number | null;
};

export type HubPipelineStages = {
  new: StageStatsNew;
  legals: StageStatsLegals;
  ready: StageStatsReady;
  exchanging: StageStatsExchanging;
  completed: StageStatsCompleted;
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function sumPence(values: Array<number | null>): number | null {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return null;
  return nonNull.reduce((a, b) => a + b, 0);
}

const EMPTY_STAGES: HubPipelineStages = {
  new: { count: 0, oldestDays: null, newThisWeek: 0, quietFiles: 0 },
  legals: { count: 0, vendorBlocking: 0, buyerBlocking: 0, bothBlocking: 0, medianDaysInLegals: null },
  ready: { count: 0, overdueToExchange: 0, medianDaysToExchange: null, totalValueLocked: null },
  exchanging: { count: 0, completingThisWeek: 0, medianDaysSinceExchange: null, totalValueClosing: null },
  completed: { count: 0, totalValueClosed: null, medianDaysToComplete: null, slaHitRate: null },
};

export async function getHubPipelineStages(vis: AgentVisibility): Promise<HubPipelineStages> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const txWhere = buildTxWhere(vis);
  // PHASE 1 4d (a)-CLASS — pre-load active buyer round ids so the cross-tx
  // milestoneCompletions filters below scope to (file-level vendor rows)
  // UNION (rows on the active buyer round). Without this, a relisted file
  // could bucket into "exchanging" purely on the strength of an ARCHIVED
  // round's VM19/PM26 completion, or bucket as "ready" because its total
  // completion count (archived + new) crosses the 15-threshold. Same
  // pattern as getHubMomentum + getHubWins.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  // Look up the specific gate codes we need:
  //   VM18 = vendor "ready to exchange" gate
  //   PM25 = purchaser "ready to exchange" gate
  //   VM19 / PM26 = exchange confirmation
  //   VM20 / PM27 = completion confirmation
  const [readyDefs, exchangeDefs, completionDefs] = await Promise.all([
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM18", "PM25"] } },
      select: { id: true, code: true },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM19", "PM26"] } },
      select: { id: true },
    }),
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM20", "PM27"] } },
      select: { id: true },
    }),
  ]);
  const vm18Id = readyDefs.find((d) => d.code === "VM18")?.id;
  const pm25Id = readyDefs.find((d) => d.code === "PM25")?.id;
  const exchangeDefIds = exchangeDefs.map((d) => d.id);
  const completionDefIds = completionDefs.map((d) => d.id);

  if (!vm18Id || !pm25Id || exchangeDefIds.length < 2 || completionDefIds.length < 2) {
    // Milestone engine hasn't been seeded — return empty stats rather than crash.
    return EMPTY_STAGES;
  }

  // Bucket most-advanced first, then split the remaining active pool.
  const [completedRows, exchangingRows, activePool] = await Promise.all([
    // completed (year to date). Fetch createdAt/completionDate/priceAtExchange
    // for median-days-to-complete + total-value-closed + SLA hit rate.
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "completed",
        completionDate: { gte: startOfYear },
      },
      select: {
        id: true,
        createdAt: true,
        completionDate: true,
        priceAtExchange: true,
        purchasePrice: true,
        twelveWeekTarget: true,
      },
    }),
    // exchanging = active with VM19 or PM26 completed AND not yet fully
    // completed. Widened from count to findMany so we can attach:
    //   - completingThisWeek     (completionDate within next 7 days)
    //   - medianDaysSinceExchange (earliest VM19/PM26 completedAt)
    //   - totalValueClosing      (sum purchasePrice)
    // All MC filters scope to the current round via roundScopedOR.
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        milestoneCompletions: {
          some: {
            milestoneDefinitionId: { in: exchangeDefIds },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
        NOT: {
          AND: [
            {
              milestoneCompletions: {
                some: {
                  milestoneDefinitionId: completionDefIds[0],
                  state: "complete",
                  OR: roundScopedOR(activeRoundIds),
                },
              },
            },
            {
              milestoneCompletions: {
                some: {
                  milestoneDefinitionId: completionDefIds[1],
                  state: "complete",
                  OR: roundScopedOR(activeRoundIds),
                },
              },
            },
          ],
        },
      },
      select: {
        id: true,
        completionDate: true,
        purchasePrice: true,
        milestoneCompletions: {
          where: {
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
            milestoneDefinitionId: { in: exchangeDefIds },
          },
          select: { completedAt: true },
          orderBy: { completedAt: "asc" },
          take: 1,
        },
      },
    }),
    // Active-not-yet-exchanging pool. Widened select carries every field
    // needed for New / Legals / Ready popovers. milestoneCompletions is
    // now ALL completed rows (was VM18/PM25 only) so we can derive both
    // gate booleans AND first-completion-at from the same fetch.
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        NOT: {
          milestoneCompletions: {
            some: {
              milestoneDefinitionId: { in: exchangeDefIds },
              state: "complete",
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        lastActivityAt: true,
        expectedExchangeDate: true,
        purchasePrice: true,
        milestoneCompletions: {
          where: {
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
          select: { milestoneDefinitionId: true, completedAt: true },
          orderBy: { completedAt: "asc" },
        },
      },
    }),
  ]);

  // Bucket the active-not-yet-exchanging pool + accumulate per-stage stats.
  const newFiles: typeof activePool = [];
  const legalsFiles: typeof activePool = [];
  const readyFiles: typeof activePool = [];

  let vendorBlocking = 0, buyerBlocking = 0, bothBlocking = 0;

  for (const tx of activePool) {
    const completions = tx.milestoneCompletions;
    const completeIds = new Set(completions.map((m) => m.milestoneDefinitionId));
    const vm18Done = completeIds.has(vm18Id);
    const pm25Done = completeIds.has(pm25Id);
    if (vm18Done && pm25Done) {
      readyFiles.push(tx);
    } else if (completions.length < 5) {
      newFiles.push(tx);
    } else {
      legalsFiles.push(tx);
      // In legals: PM25 missing = buyer-side, VM18 missing = vendor-side.
      // If both missing, count as "both" so the three add up to legals.count.
      if (!vm18Done && !pm25Done) bothBlocking++;
      else if (!vm18Done) vendorBlocking++;
      else buyerBlocking++;
    }
  }

  // NEW stats
  const newOldest = newFiles.length > 0
    ? Math.max(...newFiles.map((t) => daysBetween(now, t.createdAt)))
    : null;
  const newThisWeek = newFiles.filter((t) => t.createdAt >= sevenDaysAgo).length;
  const quietFiles = newFiles.filter((t) => !t.lastActivityAt || t.lastActivityAt < sevenDaysAgo).length;

  // LEGALS stats — median days since first completion (proxy for "days in legals")
  const legalsDurations = legalsFiles
    .map((t) => t.milestoneCompletions[0]?.completedAt)
    .filter((d): d is Date => d != null)
    .map((d) => daysBetween(now, d));
  const medianDaysInLegals = median(legalsDurations);

  // READY stats
  const readyOverdue = readyFiles.filter((t) => t.expectedExchangeDate && t.expectedExchangeDate < now).length;
  const readyDaysToExchange = readyFiles
    .map((t) => t.expectedExchangeDate)
    .filter((d): d is Date => d != null)
    .map((d) => daysBetween(d, now));
  const medianDaysToExchange = median(readyDaysToExchange);
  const totalValueLocked = sumPence(readyFiles.map((t) => t.purchasePrice));

  // EXCHANGING stats
  const completingThisWeek = exchangingRows.filter(
    (t) => t.completionDate && t.completionDate >= now && t.completionDate <= in7Days,
  ).length;
  const exchangeMarkerDates = exchangingRows
    .map((t) => t.milestoneCompletions[0]?.completedAt)
    .filter((d): d is Date => d != null)
    .map((d) => daysBetween(now, d));
  const medianDaysSinceExchange = median(exchangeMarkerDates);
  const totalValueClosing = sumPence(exchangingRows.map((t) => t.purchasePrice));

  // COMPLETED stats — prefer priceAtExchange (billing snapshot) over
  // live purchasePrice, but fall back if the snapshot is missing.
  const completedDurations = completedRows
    .filter((t) => t.completionDate != null)
    .map((t) => daysBetween(t.completionDate!, t.createdAt));
  const medianDaysToComplete = median(completedDurations);
  const totalValueClosed = sumPence(completedRows.map((t) => t.priceAtExchange ?? t.purchasePrice));
  // SLA hit rate = share of completions where completionDate <= twelveWeekTarget.
  const slaEligible = completedRows.filter((t) => t.twelveWeekTarget != null && t.completionDate != null);
  const slaHits = slaEligible.filter((t) => t.completionDate! <= t.twelveWeekTarget!).length;
  const slaHitRate = slaEligible.length > 0 ? slaHits / slaEligible.length : null;

  return {
    new: {
      count: newFiles.length,
      oldestDays: newOldest,
      newThisWeek,
      quietFiles,
    },
    legals: {
      count: legalsFiles.length,
      vendorBlocking,
      buyerBlocking,
      bothBlocking,
      medianDaysInLegals,
    },
    ready: {
      count: readyFiles.length,
      overdueToExchange: readyOverdue,
      medianDaysToExchange,
      totalValueLocked,
    },
    exchanging: {
      count: exchangingRows.length,
      completingThisWeek,
      medianDaysSinceExchange,
      totalValueClosing,
    },
    completed: {
      count: completedRows.length,
      totalValueClosed,
      medianDaysToComplete,
      slaHitRate,
    },
  };
}

// ── Weekly exchange forecast (5 weeks) ───────────────────────────────────────

export type WeekBucket = { label: string; count: number; isCurrentWeek: boolean };

export async function getHubWeeklyForecast(
  vis: AgentVisibility
): Promise<WeekBucket[]> {
  const now = new Date();

  // Monday of this week
  const startOfThisWeek = new Date(now);
  const day = startOfThisWeek.getDay();
  startOfThisWeek.setDate(startOfThisWeek.getDate() + (day === 0 ? -6 : 1 - day));
  startOfThisWeek.setHours(0, 0, 0, 0);

  const NUM_WEEKS = 5;
  const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => {
    const start = new Date(startOfThisWeek.getTime() + i * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000 - 1);
    return { start, end, label: i === 0 ? "This wk" : `+${i}w`, isCurrentWeek: i === 0 };
  });

  const cutoff = weeks[NUM_WEEKS - 1].end;
  const txWhere = buildTxWhere(vis);
  // Phase-3 OR scope for the not-yet-exchanged check.
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      status: "active",
      OR: [
        { overridePredictedDate: { gte: now, lte: cutoff } },
        { expectedExchangeDate: { gte: now, lte: cutoff } },
      ],
      NOT: {
        // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
    },
    select: { overridePredictedDate: true, expectedExchangeDate: true },
  });

  return weeks.map(({ start, end, label, isCurrentWeek }) => ({
    label,
    isCurrentWeek,
    count: transactions.filter((tx) => {
      const d = tx.overridePredictedDate ?? tx.expectedExchangeDate;
      return d && d >= start && d <= end;
    }).length,
  }));
}

// ── Service split ─────────────────────────────────────────────────────────────

export async function getHubServiceSplit(vis: AgentVisibility) {
  const txWhere = buildTxWhere(vis);
  const [selfManaged, outsourced] = await Promise.all([
    prisma.propertyTransaction.count({
      where: { ...txWhere, status: "active", serviceType: "self_managed" },
    }),
    prisma.propertyTransaction.count({
      where: { ...txWhere, status: "active", serviceType: "outsourced" },
    }),
  ]);
  return { selfManaged, outsourced };
}

// ── Attention items (active/overdue reminders) ────────────────────────────────

export type HubAttentionItem = {
  id: string;
  urgency: "escalated" | "overdue" | "due_today";
  reminderName: string;
  transaction: { id: string; propertyAddress: string };
  nextDueDate: Date;
};

export async function getHubAttentionItems(
  vis: AgentVisibility
): Promise<HubAttentionItem[]> {
  const now = new Date();
  // Generous DB upper bound — catches anything that could be "today UK"
  // regardless of DST. Final classification happens in JS via classifyReminder.
  const dbUpperBound = new Date(now.getTime() + 26 * 60 * 60 * 1000);
  const txNested = buildTxNested(vis);

  // Build the transaction filter for reminderLog.where.transaction.
  // Agent path: includes agencyId: vis.agencyId (unchanged).
  // Internal paths: internalMode branches in buildTxNested already handle scoping — no agencyId needed.
  const txLogFilter: Prisma.PropertyTransactionWhereInput =
    vis.internalMode
      ? { status: "active", ...txNested }
      : { agencyId: vis.agencyId, status: "active", ...txNested };

  // Due today or overdue, not snoozed — scoped to this agent/firm
  const logs = await prisma.reminderLog.findMany({
    where: {
      transaction: txLogFilter,
      status: "active",
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      nextDueDate: { lte: dbUpperBound },
    },
    orderBy: { nextDueDate: "asc" },
    select: {
      id: true,
      nextDueDate: true,
      reminderRule: { select: { name: true } },
      transaction: { select: { id: true, propertyAddress: true } },
      // status + snoozedUntil + chase fields all needed by classifyReminder.
      status: true,
      snoozedUntil: true,
      chaseTasks: {
        where: { status: "pending" },
        select: { status: true, priority: true, chaseCount: true },
        take: 1,
      },
    },
  });

  // Apply the canonical classifier — chased rows (chaseCount >= 1) live
  // in Coming up and shouldn't surface on the hub attention card. Only
  // escalated / overdue / due_today land here.
  const items: HubAttentionItem[] = logs
    .map((log) => {
      const bucket = classifyReminder(log, now);
      if (bucket !== "escalated" && bucket !== "overdue" && bucket !== "due_today") return null;
      return {
        id: log.id,
        urgency: bucket as HubAttentionItem["urgency"],
        reminderName: log.reminderRule.name.replace(/^Chase:\s*/i, ""),
        transaction: log.transaction,
        nextDueDate: log.nextDueDate,
      };
    })
    .filter((x): x is HubAttentionItem => x !== null);

  const order = { escalated: 0, overdue: 1, due_today: 2 };
  items.sort((a, b) => {
    const d = order[a.urgency] - order[b.urgency];
    return d !== 0 ? d : new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  return items;
}

// ── Today's diary ────────────────────────────────────────────────────────────

export type DiaryItem = {
  type: "exchange" | "completion";
  transactionId: string;
  address: string;
};

export async function getHubDiary(vis: AgentVisibility): Promise<DiaryItem[]> {
  const now = new Date();
  const todayStr = toUKDateStr(now);
  // Generous window — refined by JS filter below using UK date string.
  const windowStart = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 26 * 60 * 60 * 1000);
  const txWhere = buildTxWhere(vis);

  const [exchanges, completions] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        OR: [
          { expectedExchangeDate:  { gte: windowStart, lte: windowEnd } },
          { overridePredictedDate: { gte: windowStart, lte: windowEnd } },
        ],
      },
      select: {
        id: true, propertyAddress: true,
        expectedExchangeDate: true, overridePredictedDate: true,
        // Needed for the placeholder check below.
        twelveWeekTarget: true, activeBuyerRoundId: true,
      },
    }),
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: { in: ["active", "completed"] },
        completionDate: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, propertyAddress: true, completionDate: true },
    }),
  ]);

  const isToday = (d: Date | null) => d !== null && toUKDateStr(d) === todayStr;

  // Completions first (higher significance); deduplicate by transactionId
  const seen = new Set<string>();
  const items: DiaryItem[] = [];
  for (const tx of completions) {
    if (!isToday(tx.completionDate)) continue;
    if (!seen.has(tx.id)) { seen.add(tx.id); items.push({ type: "completion", transactionId: tx.id, address: tx.propertyAddress }); }
  }

  // ── Exchange "today" guard ────────────────────────────────────────
  // expectedExchangeDate defaults to createdAt + 84 days at file
  // creation (see createTransaction in transactions.ts). For files
  // that aren't actively maintained it rolls around as "12-week
  // placeholder == today" with no actual progress toward exchange,
  // and used to falsely surface in the diary. Surfaced 2026-06-25 by
  // Ellis on 54 Launcelot Road, BR1 5DZ — mid-enquiries, ~9 weeks
  // out, still being shown as "Exchange" today.
  //
  // Rule:
  //   - overridePredictedDate === today          → fire (explicit forecast)
  //   - expectedExchangeDate === today AND
  //       (VM18 done OR PM25 done OR VM19 done OR PM26 done) → fire
  //       (the file is genuinely near or past exchange)
  //   - expectedExchangeDate === today AND
  //       expectedExchangeDate === twelveWeekTarget AND
  //       no ready-to-exchange milestones → SKIP (placeholder lie)
  const exchangeIdsTodayByPlaceholder: string[] = [];
  const exchangeFireQueue: typeof exchanges = [];
  for (const tx of exchanges) {
    if (isToday(tx.overridePredictedDate)) {
      exchangeFireQueue.push(tx);
      continue;
    }
    if (!isToday(tx.expectedExchangeDate)) continue;
    // expectedExchangeDate is today. Check if it's the placeholder.
    const isPlaceholder = !!(
      tx.twelveWeekTarget &&
      tx.expectedExchangeDate &&
      Math.abs(tx.twelveWeekTarget.getTime() - tx.expectedExchangeDate.getTime()) < 24 * 60 * 60 * 1000
    );
    if (isPlaceholder) {
      exchangeIdsTodayByPlaceholder.push(tx.id);
    } else {
      exchangeFireQueue.push(tx);
    }
  }

  // Look up ready-to-exchange milestone state in one bulk query for
  // the placeholder candidates. Round-scoped: PM25/PM26 must be on
  // the active buyer round; vendor codes are file-level.
  if (exchangeIdsTodayByPlaceholder.length > 0) {
    const txById = new Map(exchanges.map((t) => [t.id, t]));
    const readyDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM18", "PM25", "VM19", "PM26"] } },
      select: { id: true, code: true },
    });
    const codeByDefId = new Map(readyDefs.map((d) => [d.id, d.code]));
    const comps = await prisma.milestoneCompletion.findMany({
      where: {
        transactionId: { in: exchangeIdsTodayByPlaceholder },
        state: "complete",
        milestoneDefinitionId: { in: readyDefs.map((d) => d.id) },
      },
      select: { transactionId: true, milestoneDefinitionId: true, buyerRoundId: true },
    });
    const doneByTx = new Map<string, Set<string>>();
    for (const c of comps) {
      const tx = txById.get(c.transactionId);
      if (!tx) continue;
      const code = codeByDefId.get(c.milestoneDefinitionId);
      if (!code) continue;
      // Round-scope filter: vendor codes file-level (buyerRoundId null),
      // purchaser codes must match active round.
      if (code.startsWith("PM") && c.buyerRoundId !== tx.activeBuyerRoundId) continue;
      const set = doneByTx.get(c.transactionId) ?? new Set<string>();
      set.add(code);
      doneByTx.set(c.transactionId, set);
    }
    for (const txId of exchangeIdsTodayByPlaceholder) {
      const done = doneByTx.get(txId) ?? new Set<string>();
      if (done.has("VM18") || done.has("PM25") || done.has("VM19") || done.has("PM26")) {
        const tx = txById.get(txId);
        if (tx) exchangeFireQueue.push(tx);
      }
      // else: it's a stale 12-week placeholder, file isn't near
      // exchange. Skip the diary entry.
    }
  }

  for (const tx of exchangeFireQueue) {
    if (!seen.has(tx.id)) { seen.add(tx.id); items.push({ type: "exchange", transactionId: tx.id, address: tx.propertyAddress }); }
  }
  return items;
}

// ── Recent activity ───────────────────────────────────────────────────────────

export type RecentActivity = {
  kind: "comm" | "milestone";
  description: string;
  context: string;
  transactionId: string;
  at: Date;
} | null;

function commDescription(type: string, method: string | null, content: string | null): string {
  if (type === "inbound") return "Update received from party";
  if (method === "whatsapp") return "WhatsApp sent to party";
  if (method === "email")    return "Email sent to party";
  if (method === "phone")    return "Call logged";
  if (method === "sms")      return "SMS sent to party";
  if (method === "post")     return "Letter sent to party";
  if (content?.toLowerCase().includes("manually")) return "Chase recorded manually";
  return "Communication logged";
}

export async function getHubRecentActivity(
  vis: AgentVisibility
): Promise<RecentActivity> {
  const txWhere = buildTxWhere(vis);
  const txFilter = { ...txWhere, status: { not: "draft" as never } };
  // Phase-3: scope the cross-tx OutboundMessage + MilestoneCompletion
  // reads below to active round + file-level. Pre-Phase-3 the latest
  // archived-buyer comm or PM could win as "most recent activity" on a
  // relisted file.
  const activeRoundIds = await loadActiveRoundIds(txFilter);

  const [recentComm, recentMilestone] = await Promise.all([
    prisma.outboundMessage.findFirst({
      where: {
        transaction: txFilter,
        type: { in: ["outbound", "inbound"] },
        OR: roundScopedOR(activeRoundIds),
      },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        method: true,
        content: true,
        createdAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
    // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
    prisma.milestoneCompletion.findFirst({
      where: {
        transaction: txFilter,
        state: "complete",
        OR: roundScopedOR(activeRoundIds),
      },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        summaryText: true,
        transaction: { select: { id: true, propertyAddress: true } },
        milestoneDefinition: { select: { name: true } },
      },
    }),
  ]);

  const commTime = recentComm ? new Date(recentComm.createdAt).getTime() : 0;
  const msTime = recentMilestone?.completedAt ? new Date(recentMilestone.completedAt).getTime() : 0;

  if (commTime === 0 && msTime === 0) return null;

  if (commTime >= msTime && recentComm) {
    return {
      kind: "comm",
      description: commDescription(recentComm.type, recentComm.method, recentComm.content),
      context: recentComm.transaction!.propertyAddress,
      transactionId: recentComm.transaction!.id,
      at: recentComm.createdAt,
    };
  }

  if (recentMilestone) {
    return {
      kind: "milestone",
      description: recentMilestone.summaryText ?? recentMilestone.milestoneDefinition.name,
      context: recentMilestone.transaction.propertyAddress,
      transactionId: recentMilestone.transaction.id,
      at: recentMilestone.completedAt ?? new Date(),
    };
  }

  return null;
}

// ─── Unassigned outsourced files ─────────────────────────────────────────────

export type HubUnassignedFile = {
  id: string;
  propertyAddress: string;
  agencyName: string | null;
  createdAt: Date;
};

export async function getHubUnassignedFiles(vis: AgentVisibility): Promise<HubUnassignedFile[]> {
  if (vis.internalMode !== "admin_all") return [];
  const files = await prisma.propertyTransaction.findMany({
    where: { assignedUserId: null, status: "active", serviceType: "outsourced" },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      propertyAddress: true,
      createdAt: true,
      agency: { select: { name: true } },
    },
  });
  return files.map((f) => ({
    id: f.id,
    propertyAddress: f.propertyAddress,
    agencyName: f.agency?.name ?? null,
    createdAt: f.createdAt,
  }));
}

// ─── Hub card: outsourced files with an unacknowledged relist ───
// Phase 1 commit 8b (Ellis approval, 2026-06-04).
//
// Surface files where:
//   - serviceType = "outsourced"
//   - status = "active"
//   - the ACTIVE round has roundNumber > 1 (so this came from a relist,
//     not a fresh file)
//   - that round's relistAcknowledgedAt IS NULL (no one has clicked
//     Acknowledge yet)
//
// Visibility mirrors the assign card:
//   - assigned SP (internalMode = "assigned"): sees only files
//     assigned to them
//   - admin_all: sees every unacknowledged-relisted outsourced file,
//     including files that were withdrawn before being assigned and
//     have assignedUserId = null (the "fall into a void" case Ellis
//     called out)
//   - agency callers (no internalMode): no visibility — this card
//     surfaces operational state for the SP team, not the agency
//
// Each round needs its own click — a second relist creates a fresh
// BuyerRound with relistAcknowledgedAt = NULL by default, so the
// card naturally re-raises without any reset code.
export type HubRelistAck = {
  // transaction (the address + agency the card shows)
  transactionId: string;
  propertyAddress: string;
  agencyName: string | null;
  // round-acknowledgement key (what Acknowledge stamps)
  roundId: string;
  roundNumber: number;
  newBuyerName: string;     // purchaser Contact stamped to this round
  archivedAt: Date | null;   // when the previous round closed
  relistedAt: Date;          // BuyerRound.createdAt — when round was opened
};

export async function getHubRelistsToAcknowledge(vis: AgentVisibility): Promise<HubRelistAck[]> {
  // Build the visibility-scoped tx filter using the same pattern as the
  // assign card. Agency callers see nothing here.
  let txWhere: Prisma.PropertyTransactionWhereInput;
  if (vis.internalMode === "admin_all") {
    txWhere = { serviceType: "outsourced", status: "active" };
  } else if (vis.internalMode === "assigned") {
    txWhere = { serviceType: "outsourced", status: "active", assignedUserId: vis.userId };
  } else {
    return [];
  }

  // Round-side filter: roundNumber > 1 AND relistAcknowledgedAt IS NULL.
  // We query BuyerRound directly (not PropertyTransaction) so the
  // partial index on relistAcknowledgedAt IS NULL is hit.
  const rounds = await prisma.buyerRound.findMany({
    where: {
      relistAcknowledgedAt: null,
      roundNumber: { gt: 1 },
      // The active round on this tx — there's only ever one round per
      // tx with activeForTransaction relation set. The transaction-side
      // filter scopes this to the right visibility set.
      activeForTransaction: { is: txWhere },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      roundNumber: true,
      createdAt: true,
      archivedAt: true,
      transactionId: true,
    },
  });
  if (rounds.length === 0) return [];

  // Pull the rest in one batch — transaction (for address + agency name)
  // and purchaser Contact (for buyer name).
  const txIds = rounds.map((r) => r.transactionId);
  const [txs, contacts] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { id: { in: txIds } },
      select: { id: true, propertyAddress: true, agency: { select: { name: true } } },
    }),
    prisma.contact.findMany({
      where: { buyerRoundId: { in: rounds.map((r) => r.id) }, roleType: "purchaser" },
      orderBy: { createdAt: "asc" },
      select: { name: true, buyerRoundId: true },
    }),
  ]);
  const txById = new Map(txs.map((t) => [t.id, t]));
  const buyerByRound = new Map(contacts.map((c) => [c.buyerRoundId ?? "", c.name]));

  return rounds.map((r) => {
    const tx = txById.get(r.transactionId);
    return {
      transactionId: r.transactionId,
      propertyAddress: tx?.propertyAddress ?? "(unknown address)",
      agencyName: tx?.agency?.name ?? null,
      roundId: r.id,
      roundNumber: r.roundNumber,
      newBuyerName: buyerByRound.get(r.id) ?? "(no buyer recorded)",
      archivedAt: null, // previous round's archivedAt, not this one's
      relistedAt: r.createdAt,
    };
  });
}

// ─── Chain setup pending (closed-loop chain arc 2026-06-05) ────────────────
// Files where the relist modal collected "Don't know yet" for the new
// buyer's onward sale. The hub surfaces a prompt until the agent either
// attaches a chain link below their position or explicitly confirms there
// isn't one. Mirrors the visibility scope of getHubRelistsToAcknowledge.

export type HubChainSetupPending = {
  transactionId: string;
  propertyAddress: string;
  agencyName: string | null;
  newBuyerName: string | null;
  flaggedAt: Date;
};

export async function getHubChainSetupPending(vis: AgentVisibility): Promise<HubChainSetupPending[]> {
  // Mirrors the visibility branches used by other hub services. Internal
  // staff: admin sees all, SP sees assigned. Agent callers: scoped to
  // their own agency / firm.
  let txWhere: Prisma.PropertyTransactionWhereInput;
  if (vis.internalMode === "admin_all") {
    // Internal team only progresses outsourced files — same rule as
    // buildTxWhere above.
    txWhere = { status: "active", chainSetupPending: true, serviceType: "outsourced" };
  } else if (vis.internalMode === "assigned") {
    txWhere = { status: "active", chainSetupPending: true, assignedUserId: vis.userId };
  } else if (vis.seeAll) {
    txWhere = vis.firmName
      ? { status: "active", chainSetupPending: true, agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { status: "active", chainSetupPending: true, agencyId: vis.agencyId };
  } else {
    txWhere = { status: "active", chainSetupPending: true, agencyId: vis.agencyId, agentUserId: vis.userId };
  }

  const txs = await prisma.propertyTransaction.findMany({
    where: txWhere,
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      propertyAddress: true,
      updatedAt: true,
      agency: { select: { name: true } },
      activeBuyerRoundId: true,
    },
  });
  if (txs.length === 0) return [];

  const roundIds = txs.map((t) => t.activeBuyerRoundId).filter((id): id is string => id !== null);
  const purchasers = await prisma.contact.findMany({
    where: { buyerRoundId: { in: roundIds }, roleType: "purchaser" },
    orderBy: { createdAt: "asc" },
    select: { name: true, buyerRoundId: true },
  });
  const purchaserByRound = new Map(purchasers.map((c) => [c.buyerRoundId ?? "", c.name]));

  return txs.map((t) => ({
    transactionId: t.id,
    propertyAddress: t.propertyAddress,
    agencyName: t.agency?.name ?? null,
    newBuyerName: t.activeBuyerRoundId ? purchaserByRound.get(t.activeBuyerRoundId) ?? null : null,
    flaggedAt: t.updatedAt,
  }));
}

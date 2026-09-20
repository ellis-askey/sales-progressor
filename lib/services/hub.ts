import { prisma } from "@/lib/prisma";
import type { Prisma, ClientType } from "@prisma/client";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { AgentVisibility } from "./agent";
import type { FlagKind } from "./problem-detection";
import { toUKDateStr } from "@/lib/utils";
import { possessiveClientLabel } from "@/lib/updates-copy";
import { classifyReminder } from "@/lib/reminders/classify";
import { resolveAutopilot, type AutopilotFlags } from "@/lib/services/reminder-autopilot";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { isExchangeOverdueStuck } from "@/lib/services/exchange-prediction";
import type { ChaseContact, SolicitorRef } from "@/lib/services/chase-recipients";
import { calculateFileFeesPence, calculateProgressionFeePence, type FileFeesInput } from "@/lib/services/fees";

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
  portal_gone_quiet:         "watch",
  no_portal_activity:        "attention",
  overdue_milestone:         "attention",
  // Resilience audit PR 6: a dormant/empty file needs a look to get going, but
  // it isn't time-critical — medium "attention", never "overdue".
  needs_setup:               "attention",
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

// ── Hub subtitle signals ──────────────────────────────────────────────────────
// Compact set of counts that drive the journey-aware hub subtitle (the line
// under the greeting). Real sales exclude demo files. Cheap count queries plus
// the shared attention source. See getHubSubtitle() in the hub view.
export type HubSubtitleSignals = {
  realSales: number;          // lifetime non-demo, non-draft files in scope
  hasDemo: boolean;           // a demo file exists in scope
  completionsToday: number;   // completionDate is today
  exchangesToday: number;     // active + expected/predicted exchange is today
  exchangingThisWeek: number; // active + expected/predicted exchange in next 7 days
  attentionCount: number;     // files flagged as needing attention
};

// Cheap "does this agent have any real files at all?" — a single scoped count,
// used to send a brand-new (zero-sale) account straight to the empty state
// without the loading card. Demo + draft rows don't count as a real sale.
// Same scope as every other hub query, so it can't leak across tenants.
export async function hubHasFiles(vis: AgentVisibility): Promise<boolean> {
  const row = await prisma.propertyTransaction.findFirst({
    where: { ...buildTxWhere(vis), isDemo: false, status: { not: "draft" } },
    select: { id: true },
  });
  return row !== null;
}

// First-sale hero (Hub): a brand-new user who reached us by CLAIMING a chain
// invite and has exactly one real sale — the one they claimed — and nothing
// else. Returns that sale so the Hub can show the welcome hero; null the moment
// they have any other real sale (the hero retires once they add another).
// Personal scope (agentUserId = the claimer), so it only ever fires for the
// individual who claimed, never a colleague viewing agency-wide.
export async function getClaimedFirstSale(
  vis: AgentVisibility,
): Promise<{ id: string; address: string; photoStoragePath: string | null } | null> {
  const where = {
    agencyId: vis.agencyId,
    agentUserId: vis.userId,
    isDemo: false,
    status: { not: "draft" as const },
  };
  // Exactly one real sale, or the hero doesn't apply.
  if ((await prisma.propertyTransaction.count({ where })) !== 1) return null;
  const tx = await prisma.propertyTransaction.findFirst({
    where,
    select: {
      id: true,
      propertyAddress: true,
      photoStoragePath: true,
      chainLink: { select: { claimedByUserId: true } },
    },
  });
  // Only when that single sale is one they CLAIMED themselves.
  if (!tx || tx.chainLink?.claimedByUserId !== vis.userId) return null;
  return { id: tx.id, address: tx.propertyAddress, photoStoragePath: tx.photoStoragePath };
}

export async function getHubSubtitleSignals(vis: AgentVisibility): Promise<HubSubtitleSignals> {
  const txWhere = buildTxWhere(vis);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const [realSales, demoCount, completionsToday, exchangesToday, exchangingThisWeek, attentionItems] = await Promise.all([
    prisma.propertyTransaction.count({ where: { ...txWhere, isDemo: false, status: { not: "draft" } } }),
    prisma.propertyTransaction.count({ where: { ...txWhere, isDemo: true } }),
    prisma.propertyTransaction.count({
      where: { ...txWhere, isDemo: false, completionDate: { gte: startOfToday, lte: endOfToday } },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere, isDemo: false, status: "active",
        // Effective date = manual move if set, else the automatic prediction.
        // Mirrors the diary (a47552e2): a file moved out to another month must
        // not read "exchange today" just because its raw prediction lands today.
        OR: [
          { overridePredictedDate: { gte: startOfToday, lte: endOfToday } },
          { overridePredictedDate: null, expectedExchangeDate: { gte: startOfToday, lte: endOfToday } },
        ],
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere, isDemo: false, status: "active",
        OR: [
          { overridePredictedDate: { gte: now, lte: in7Days } },
          { overridePredictedDate: null, expectedExchangeDate: { gte: now, lte: in7Days } },
        ],
      },
    }),
    getHubAttentionItems(vis),
  ]);

  return {
    realSales,
    hasDemo: demoCount > 0,
    completionsToday,
    exchangesToday,
    exchangingThisWeek,
    attentionCount: attentionItems.length,
  };
}

// ── Pipeline stats ────────────────────────────────────────────────────────────

// ── Shared fee-input plumbing ────────────────────────────────────────────────
// The per-file inputs calculateFileFeesPence / calculateProgressionFeePence need.
// One select fragment + one mapper, shared by the pipeline + service-split totals
// so they can't drift from each other or from the property-file Fees card.
const FEE_INPUT_SELECT = {
  purchasePrice: true, agentFeeAmount: true, agentFeePercent: true,
  referralFee: true, brokerReferralFee: true, onwardBrokerReferralFee: true,
  serviceType: true, freeOnExchange: true, firstOutsourcedFree: true,
  assignedUser: { select: { clientType: true, legacyFee: true } },
  agency: { select: { feeTier: true, legacyOutsourcedFeePence: true } },
} as const;

type FeeInputRow = {
  purchasePrice: number | null; agentFeeAmount: number | null; agentFeePercent: Prisma.Decimal | null;
  referralFee: number | null; brokerReferralFee: number | null; onwardBrokerReferralFee: number | null;
  serviceType: "self_managed" | "outsourced"; freeOnExchange: boolean; firstOutsourcedFree: boolean;
  assignedUser: { clientType: ClientType; legacyFee: number | null } | null;
  agency: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null;
};

function toFeeInput(tx: FeeInputRow): FileFeesInput {
  return {
    purchasePrice: tx.purchasePrice, agentFeeAmount: tx.agentFeeAmount, agentFeePercent: tx.agentFeePercent,
    referralFee: tx.referralFee, brokerReferralFee: tx.brokerReferralFee, onwardBrokerReferralFee: tx.onwardBrokerReferralFee,
    serviceType: tx.serviceType, freeOnExchange: tx.freeOnExchange, firstOutsourcedFree: tx.firstOutsourcedFree,
    assignedUser: tx.assignedUser, agencyOverride: tx.agency,
  };
}

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
    // Phase 4 (2026-09-18, PERF-13): the separate activeCount count query was
    // byte-identical in scope to the pipelineFiles findMany below — the count
    // is now derived as pipelineFiles.length (same where, same semantics).
    prisma.propertyTransaction.count({
      where: {
        ...txWhere,
        status: "active",
        // Effective exchange date (override wins, matching every display surface)
        // in the next 30 days. Kept identical to the weekly/monthly buckets below.
        OR: [
          { overridePredictedDate: { gte: now, lte: in30Days } },
          { overridePredictedDate: null, expectedExchangeDate: { gte: now, lte: in30Days } },
        ],
      },
    }),
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, status: "active" },
      select: { ...FEE_INPUT_SELECT },
    }),
    prisma.propertyTransaction.count({
      where: { ...txWhere, createdAt: { gte: startOfMonth }, status: { not: "draft" } },
    }),

    // ── Coming up: exchanging this week ────────────────────────────────────────
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        // Effective exchange date (override wins) in the next 7 days.
        OR: [
          { overridePredictedDate: { gte: now, lte: in7Days } },
          { overridePredictedDate: null, expectedExchangeDate: { gte: now, lte: in7Days } },
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
      select: { id: true, ...FEE_INPUT_SELECT },
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
        // Effective exchange date (override wins) inside this calendar month.
        OR: [
          { overridePredictedDate: { gte: startOfMonth, lte: endOfMonth } },
          { overridePredictedDate: null, expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth } },
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
        NOT: [
          {
            // PHASE 1 4d (a)-CLASS resolved — Phase-3 OR scope below.
            milestoneCompletions: {
              some: {
                state: "complete",
                milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
                OR: roundScopedOR(activeRoundIds),
              },
            },
          },
          // Enquiries rework: exclude files mid-enquiries (open, unsatisfied
          // loop). They're milestone-quiet by design; the tracker's own
          // 15-working-day escalation is the enquiries stall signal.
          { enquiryTracker: { is: { closedAt: null } } },
        ],
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

  // Our (Sales Progressor's) forecast revenue — the progression fees we'd earn
  // across the live pipeline, and specifically from files exchanging this week.
  // Self-managed contributes £0 (self-progression is free). Internal-only in the UI.
  const pipelineFeesPence = pipelineFiles.reduce(
    (sum, tx) => sum + calculateProgressionFeePence(toFeeInput(tx)), 0
  );
  const feesThisWeekPence = exchangingThisWeekTxs.reduce(
    (sum, tx) => sum + calculateProgressionFeePence(toFeeInput(tx)), 0
  );

  return {
    // Existing
    activeFiles: pipelineFiles.length,
    exchangingSoon,
    pipelineValuePence,
    pipelineFeesPence,
    newThisMonth,
    // Coming up
    comingUp: {
      exchangingThisWeek: exchangingThisWeekTxs.length,
      completingThisWeek: completingThisWeekTxs.length,
      feesThisWeekPence,
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

// Health strip for the Pipeline Health card: how fast files reach exchange, how
// many hit the 12-week target, and this month's exchanges vs last. Derived from
// the exchangedAt stamp (set on VM19/PM26 for every file) + twelveWeekTarget +
// createdAt, scoped by the viewer — so an agency sees its own performance, not
// the platform's. One bounded query (last ~90 days covers both the median sample
// and the month buckets).
export async function getHubPipelineHealth(vis: AgentVisibility): Promise<{
  medianDaysToExchange: number | null;
  within12WeekPct: number | null;
  // Rolling 30-day windows, NOT calendar months — a month-to-date vs last-full-
  // month comparison reads as a false drop early in the month. Rolling windows
  // are always like-for-like.
  exchangesLast30: number;
  exchangesPrev30: number;
  // Exchanges per week over the last 8 weeks (oldest → newest) for the sparkline.
  weeklyExchanges: number[];
}> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);
  const d90 = new Date(now.getTime() - 90 * 86400000);
  const txWhere = buildTxWhere(vis);

  const exchanged = await prisma.propertyTransaction.findMany({
    where: { ...txWhere, exchangedAt: { gte: d90 } },
    select: { exchangedAt: true, createdAt: true, twelveWeekTarget: true },
  });

  let exchangesLast30 = 0;
  let exchangesPrev30 = 0;
  const recentDays: number[] = []; // days-to-exchange over the full 90-day sample
  let slaEligible = 0;
  let slaHit = 0;
  const SPARK_WEEKS = 8;
  const weeklyExchanges = new Array<number>(SPARK_WEEKS).fill(0);
  const weekMs = 7 * 86400000;

  for (const tx of exchanged) {
    const ex = tx.exchangedAt;
    if (!ex) continue;
    if (ex >= d30) exchangesLast30++;
    else if (ex >= d60) exchangesPrev30++;

    const weeksAgo = Math.floor((now.getTime() - ex.getTime()) / weekMs);
    if (weeksAgo >= 0 && weeksAgo < SPARK_WEEKS) weeklyExchanges[SPARK_WEEKS - 1 - weeksAgo]++;

    recentDays.push(Math.max(0, Math.round((ex.getTime() - tx.createdAt.getTime()) / 86400000)));
    if (tx.twelveWeekTarget) {
      slaEligible++;
      if (ex <= tx.twelveWeekTarget) slaHit++;
    }
  }

  const medianDaysToExchange = recentDays.length
    ? (() => {
        const s = [...recentDays].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
      })()
    : null;

  const within12WeekPct = slaEligible > 0 ? Math.round((slaHit / slaEligible) * 100) : null;

  return { medianDaysToExchange, within12WeekPct, exchangesLast30, exchangesPrev30, weeklyExchanges };
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

// ── Gone-quiet queue ──────────────────────────────────────────────────────────

const GONE_QUIET_KINDS = ["long_silence", "portal_gone_quiet", "no_portal_activity"] as const;

export type GoneQuietItem = {
  transactionId: string;
  propertyAddress: string;
  photoStoragePath: string | null;
  kind: string;
  subtext: string;
  pillLabel: string;
  // Days since the last logged activity — shown for the comms-silence flag
  // where it's the meaningful number. Null for the portal flags (portal
  // engagement, not comms) and when nothing's ever been logged.
  lastContactDays: number | null;
  // Predicted exchange date (override ?? predicted) → the "how urgent" chip.
  exchangeDate: Date | null;
  // Per-kind "when" stamps for the row's context line — the date that actually
  // relates to why the file is flagged:
  //   portal_gone_quiet → lastPortalVisitAt  ("Last opened …")
  //   long_silence      → lastContactAt      ("Last contact …")
  //   no_portal_activity→ portalSetupAt      ("Set up …, never opened")
  lastPortalVisitAt: Date | null;
  lastContactAt: Date | null;
  portalSetupAt: Date | null;
};

const GONE_QUIET_PILL: Record<string, string> = {
  portal_gone_quiet: "Gone quiet",
  no_portal_activity: "Never engaged",
  long_silence: "No contact",
};

// Hub "Gone quiet" queue (internal staff for now). Surfaces files that have gone
// dark: a client who was engaging and stopped (portal_gone_quiet), one who never
// engaged (no_portal_activity), or a file with no communication logged for 10+
// days (long_silence — meaningful for our files, where comms are actually
// captured). One row per file, longest-standing concern first. Read-only
// surfacing of the nightly problem-detection flags, which otherwise only reach
// the weekly email. Deliberately separate from the attention card: an overdue
// step is a different thing from a whole file going quiet.
export async function getGoneQuietFiles(vis: AgentVisibility, excludeTxIds: string[] = []): Promise<GoneQuietItem[]> {
  const txNested = buildTxNested(vis);
  const now = new Date();
  // Exchange = the finish line for "gone quiet" (see below). "Exchanged" is the
  // exchange milestone (VM19/PM26) complete on the ACTIVE round — the same
  // definition the pipeline uses (getHubPipelineStages), round-scoped so an
  // archived round's exchange on a relisted file doesn't wrongly suppress.
  const activeRoundIds = await loadActiveRoundIds(buildTxWhere(vis));
  const flags = await prisma.transactionFlag.findMany({
    where: {
      resolvedAt: null,
      kind: { in: [...GONE_QUIET_KINDS] },
      transaction: {
        status: "active",
        // Once a file has exchanged, client portal silence is expected (nothing
        // left for them to do until completion). The detector stops raising the
        // quiet flags post-exchange (lib/services/problem-detection.ts) and
        // auto-resolves stale ones on its next run; this guard hides them
        // immediately, without waiting for that run.
        NOT: {
          milestoneCompletions: {
            some: {
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
              state: "complete",
              OR: roundScopedOR(activeRoundIds),
            },
          },
        },
        ...txNested,
        // Don't repeat a file that's already in "Needs your attention".
        ...(excludeTxIds.length ? { id: { notIn: excludeTxIds } } : {}),
        // Not dismissed (snooze still active).
        hubCardDismissals: { none: { cardKind: "gone_quiet", dismissedUntil: { gt: now } } },
      },
      // agencyId only scopes agency viewers; internal staff are scoped by
      // txNested (outsourced / assigned) and carry a null agencyId, so applying
      // it there would wrongly match nothing (the getHubFlags FU-05 bug).
      ...(vis.internalMode ? {} : { agencyId: vis.agencyId }),
    },
    orderBy: { detectedAt: "asc" },
    select: {
      kind: true, reason: true, detectedAt: true,
      transaction: {
        select: {
          id: true, propertyAddress: true, photoStoragePath: true, lastActivityAt: true,
          expectedExchangeDate: true, overridePredictedDate: true, createdAt: true,
          activeBuyerRound: { select: { createdAt: true } },
          contacts: { select: { id: true, name: true, roleType: true } },
        },
      },
    },
  });

  const firstName = (n: string) => extractFirstName(n);

  // Name the actual client who went quiet (item 1). The flag doesn't record
  // which contact stopped visiting, so re-derive it the way the detector does:
  // a contact who visited the portal on 3+ days then went quiet for 14+. One
  // grouped read across every quiet file's contacts, then match per file.
  const QUIET_DAYS = 14, ENGAGED_DAYS = 3;
  const quietContactIds = flags
    .filter((f) => f.kind === "portal_gone_quiet")
    .flatMap((f) => f.transaction.contacts.map((c) => c.id));
  const visitAgg = quietContactIds.length
    ? await prisma.portalVisit.groupBy({
        by: ["contactId"],
        where: { contactId: { in: quietContactIds } },
        _count: { day: true },
        _max: { day: true },
      })
    : [];
  const visitByContact = new Map(visitAgg.map((v) => [v.contactId, { days: v._count.day, lastDay: v._max.day }]));

  // Broken silence clears the card (Ellis, 2026-09-18). The row is a to-do —
  // "this client's gone quiet, give them a human touch" — so it hides once
  // EITHER side has broken the silence in the last OUTREACH_QUIET_DAYS:
  //   - We reached out: activity-tab compose, a chase sent from the drawer, a
  //     logged call / text, an outbound WhatsApp (bridge or import), or a
  //     portal chat message from the team.
  //   - They got in touch: any inbound message from a client on the file —
  //     including inbound WhatsApps, which the portal-visit-based detector
  //     can't see. (A portal visit already clears the underlying flag via the
  //     nightly detector.)
  // The window matches a manual dismiss, so if the client still hasn't
  // re-engaged 14 days after the last touch, the row resurfaces.
  //
  // Automated sends (engine chases, milestone emails, weekly updates —
  // isAutomated: true) deliberately do NOT count: they fire on active files
  // regardless, and they aren't the human touch the card is asking for.
  // method: null outbound rows are excluded too — those are the passive
  // in_app chase echoes mirrored onto the portal, not a direct communication.
  // WhatsApp imports backdate sentAt to the real message time, so the window
  // checks sentAt when present and falls back to createdAt.
  const OUTREACH_QUIET_DAYS = 14;
  const outreachSince = new Date(now.getTime() - OUTREACH_QUIET_DAYS * 86400000);
  const candidateTxIds = [...new Set(flags.map((f) => f.transaction.id))];
  const [touchRows, portalChat] = candidateTxIds.length
    ? await Promise.all([
        prisma.outboundMessage.findMany({
          where: {
            transactionId: { in: candidateTxIds },
            OR: [{ sentAt: { gte: outreachSince } }, { sentAt: null, createdAt: { gte: outreachSince } }],
            AND: [{
              OR: [
                { type: "outbound", isAutomated: false, method: { not: null } },
                { type: "inbound" },
              ],
            }],
          },
          select: { transactionId: true, contactIds: true },
        }),
        prisma.portalMessage.findMany({
          where: { transactionId: { in: candidateTxIds }, fromClient: false, createdAt: { gte: outreachSince } },
          select: { transactionId: true },
        }),
      ])
    : [[], []];
  const touchesByTx = new Map<string, string[][]>();
  for (const m of touchRows) {
    if (!m.transactionId) continue;
    const arr = touchesByTx.get(m.transactionId) ?? [];
    arr.push(m.contactIds);
    touchesByTx.set(m.transactionId, arr);
  }
  const portalChatTxIds = new Set(portalChat.map((p) => p.transactionId));
  // The touch must involve a CLIENT contact on the file — a solicitor-only
  // chase (empty / solicitor contactIds) isn't contact with the quiet client.
  const silenceBroken = (txId: string, contacts: { id: string; roleType: string }[]): boolean => {
    if (portalChatTxIds.has(txId)) return true;
    const clientIds = new Set(contacts.filter((c) => c.roleType === "vendor" || c.roleType === "purchaser").map((c) => c.id));
    return (touchesByTx.get(txId) ?? []).some((ids) => ids.some((id) => clientIds.has(id)));
  };
  // The engaged-then-quiet contact on a file, most-engaged first, or null. Carries
  // the last day they opened the portal so the row can show "Last opened …".
  const quietClient = (contacts: { id: string; name: string }[]): { name: string; lastDay: string | null } | null => {
    const candidates = contacts
      .map((c) => ({ c, v: visitByContact.get(c.id) }))
      .filter((x): x is { c: { id: string; name: string }; v: { days: number; lastDay: string | null } } => {
        if (!x.v || !x.v.lastDay || x.v.days < ENGAGED_DAYS) return false;
        const daysSince = Math.floor((now.getTime() - new Date(`${x.v.lastDay}T00:00:00Z`).getTime()) / 86400000);
        return daysSince >= QUIET_DAYS;
      })
      .sort((a, b) => b.v.days - a.v.days);
    return candidates[0] ? { name: firstName(candidates[0].c.name), lastDay: candidates[0].v.lastDay } : null;
  };

  // One row per file — the earliest-detected (longest-standing) flag wins.
  const seen = new Set<string>();
  const items: GoneQuietItem[] = [];
  for (const f of flags) {
    const tx = f.transaction;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    // Someone broke the silence since they went quiet → cleared for now.
    if (silenceBroken(tx.id, tx.contacts)) continue;
    // Name the client only when there's a single buyer (unambiguous).
    const buyers = tx.contacts.filter((c) => c.roleType === "purchaser");
    const who = buyers.length === 1 ? firstName(buyers[0].name) : null;
    let subtext: string;
    let lastPortalVisitAt: Date | null = null;
    const lastContactDays = tx.lastActivityAt
      ? Math.floor((now.getTime() - new Date(tx.lastActivityAt).getTime()) / 86400000)
      : null;
    if (f.kind === "portal_gone_quiet") {
      // Prefer the specific person who went quiet; fall back to the sole buyer,
      // then a generic label.
      const q = quietClient(tx.contacts);
      const named = q?.name ?? who;
      subtext = `${named ?? "A client"} was checking the portal regularly, then stopped.`;
      // The last day they opened the portal — from the quiet contact, else the
      // sole buyer's own visit record.
      const lastDay = q?.lastDay ?? (buyers.length === 1 ? visitByContact.get(buyers[0].id)?.lastDay ?? null : null);
      lastPortalVisitAt = lastDay ? new Date(`${lastDay}T00:00:00Z`) : null;
    } else if (f.kind === "no_portal_activity") {
      subtext = who ? `${who} hasn't opened the portal since it was set up.` : "No client has opened the portal since it was set up.";
    } else {
      subtext = lastContactDays != null
        ? `No contact logged in ${lastContactDays} ${lastContactDays === 1 ? "day" : "days"}.`
        : "No calls, emails or messages logged on this file.";
    }
    items.push({
      transactionId: tx.id,
      propertyAddress: tx.propertyAddress,
      photoStoragePath: tx.photoStoragePath,
      kind: f.kind,
      subtext,
      pillLabel: GONE_QUIET_PILL[f.kind] ?? "Quiet",
      lastContactDays: f.kind === "long_silence" ? lastContactDays : null,
      exchangeDate: tx.overridePredictedDate ?? tx.expectedExchangeDate ?? null,
      lastPortalVisitAt,
      lastContactAt: tx.lastActivityAt ?? null,
      portalSetupAt: tx.activeBuyerRound?.createdAt ?? tx.createdAt ?? null,
    });
  }
  return items;
}

// ── No-comms queue (To-Do) ────────────────────────────────────────────────────
// Files we've gone quiet on, split per side. A side is "drifting" when we've
// sent that client nothing for NO_COMMS_DAYS AND the file itself hasn't moved
// for NO_STEP_DAYS. The step gate is file-level (a completed milestone usually
// fires a client email, so real progress counts as contact); the comms gate is
// per side. Enquiry ball-moving writes neither an OutboundMessage nor a
// PortalMessage, so a file bouncing enquiries with nothing going out to the
// client still surfaces — deliberately. Post-exchange files are excluded
// (silence there is expected). A qualifying file shows BOTH sides for context,
// so the agent sees the last time we touched base with each; only a drifting
// side is flagged. Reaching out on a side, or completing a step, clears it on
// the next load. A per-side snooze (HubCardDismissal cardKind "no_comms",
// signature = side) hides one side for a chosen window.

const NO_COMMS_DAYS = 14;
const NO_STEP_DAYS = 30;

export type NoCommsSide = {
  side: "vendor" | "purchaser";
  name: string;               // combined client display for the side
  contactIds: string[];       // every client contact on this side (portal update targets all)
  primaryContactId: string;   // first contact — the one email / WhatsApp / call address
  email: string | null;       // first side contact with an email
  phone: string | null;       // first side contact with a phone
  lastContactAt: Date | null; // most recent comm to/from this side, any channel
  daysSince: number | null;   // null = nothing ever logged
  drifting: boolean;          // no contact within NO_COMMS_DAYS
};

export type NoCommsItem = {
  transactionId: string;
  propertyAddress: string;
  addressLine: string;        // first line ("12 Elm Grove, Redland")
  townPostcode: string;       // "Bristol · BS6 7DL" or ""
  photoStoragePath: string | null;
  sides: NoCommsSide[];
  worstDays: number;          // longest silence across drifting sides (sort key)
};

// First line + town/postcode split — mirrors splitAddress in AgentRemindersList
// (a UK address's last two comma parts are town + postcode).
function splitAddressParts(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return { line: parts[0] ?? address, location: parts.slice(1).join(" · ") };
  return { line: parts.slice(0, -2).join(", "), location: parts.slice(-2).join(" · ") };
}

export async function getNoCommsFiles(vis: AgentVisibility): Promise<NoCommsItem[]> {
  const now = new Date();
  const commsCutoffMs = now.getTime() - NO_COMMS_DAYS * 86_400_000;
  const stepCutoff = new Date(now.getTime() - NO_STEP_DAYS * 86_400_000);
  const txWhere = buildTxWhere(vis);
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const files = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      isDemo: false,
      status: "active",
      // Not exchanged on the active round — post-exchange silence is expected.
      NOT: {
        milestoneCompletions: {
          some: {
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            state: "complete",
            OR: roundScopedOR(activeRoundIds),
          },
        },
      },
      // No step completed within NO_STEP_DAYS (round-scoped). A completion
      // counts by its real date (eventDate) or, lacking one, when we marked it.
      milestoneCompletions: {
        none: {
          state: "complete",
          OR: roundScopedOR(activeRoundIds),
          AND: [{ OR: [{ eventDate: { gte: stepCutoff } }, { eventDate: null, completedAt: { gte: stepCutoff } }] }],
        },
      },
    },
    select: {
      id: true, propertyAddress: true, photoStoragePath: true,
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, phone: true, roleType: true },
      },
      hubCardDismissals: {
        where: { cardKind: "no_comms", dismissedUntil: { gt: now } },
        select: { signature: true },
      },
    },
  });
  if (files.length === 0) return [];

  const fileIds = files.map((f) => f.id);
  const careIds = new Set(files.flatMap((f) => f.contacts.map((c) => c.id)));
  if (careIds.size === 0) return [];

  // Latest comm per contact: newest OutboundMessage touching the contact (any
  // real outbound OR inbound — automated counts here, unlike gone-quiet) plus
  // newest PortalMessage for the contact (either direction).
  const [obRows, pmRows] = await Promise.all([
    prisma.outboundMessage.findMany({
      where: {
        transactionId: { in: fileIds },
        contactIds: { hasSome: [...careIds] },
        OR: [{ type: "outbound", method: { not: null } }, { type: "inbound" }],
      },
      select: { contactIds: true, sentAt: true, createdAt: true },
    }),
    prisma.portalMessage.findMany({
      where: { transactionId: { in: fileIds }, contactId: { in: [...careIds] } },
      select: { contactId: true, createdAt: true },
    }),
  ]);

  const lastByContact = new Map<string, number>();
  const bump = (id: string, t: Date | null) => {
    if (!t) return;
    const ms = t.getTime();
    const prev = lastByContact.get(id);
    if (prev === undefined || ms > prev) lastByContact.set(id, ms);
  };
  for (const m of obRows) { const t = m.sentAt ?? m.createdAt; for (const id of m.contactIds) if (careIds.has(id)) bump(id, t); }
  for (const m of pmRows) bump(m.contactId, m.createdAt);

  const combineNames = (names: string[]): string => {
    if (names.length === 1) return names[0];
    return names.map((n) => extractFirstName(n)).join(" & ");
  };

  const items: NoCommsItem[] = [];
  for (const f of files) {
    const dismissed = new Set(f.hubCardDismissals.map((d) => d.signature));
    const sides: NoCommsSide[] = [];
    let anyDrift = false;
    let worst = 0;
    for (const role of ["vendor", "purchaser"] as const) {
      if (dismissed.has(role)) continue;
      const roleContacts = f.contacts.filter((c) => c.roleType === role);
      if (roleContacts.length === 0) continue;
      let lastMs: number | null = null;
      for (const c of roleContacts) {
        const ms = lastByContact.get(c.id);
        if (ms !== undefined && (lastMs === null || ms > lastMs)) lastMs = ms;
      }
      const daysSince = lastMs !== null ? Math.floor((now.getTime() - lastMs) / 86_400_000) : null;
      const drifting = lastMs === null || lastMs < commsCutoffMs;
      if (drifting) { anyDrift = true; worst = Math.max(worst, daysSince ?? 9_999); }
      sides.push({
        side: role,
        name: combineNames(roleContacts.map((c) => c.name)),
        contactIds: roleContacts.map((c) => c.id),
        primaryContactId: roleContacts[0].id,
        email: roleContacts.find((c) => c.email)?.email ?? null,
        phone: roleContacts.find((c) => c.phone)?.phone ?? null,
        lastContactAt: lastMs !== null ? new Date(lastMs) : null,
        daysSince,
        drifting,
      });
    }
    // Only surface a file when at least one non-snoozed side is actually
    // drifting — a file whose sole quiet side is snoozed drops off.
    if (!anyDrift || sides.length === 0) continue;
    const { line, location } = splitAddressParts(f.propertyAddress);
    items.push({
      transactionId: f.id,
      propertyAddress: f.propertyAddress,
      addressLine: line,
      townPostcode: location,
      photoStoragePath: f.photoStoragePath,
      sides,
      worstDays: worst,
    });
  }
  // Longest-silent file first.
  items.sort((a, b) => b.worstDays - a.worstDays);
  return items;
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
  // Free-text why-on-hold captured when the hold was placed. Null for holds
  // placed before the reason field existed, or when the user skipped it.
  reason: string | null;
  // Name of the user who placed the hold.
  placedByName: string | null;
  // Property photo storage path (null when no photo uploaded). Signed to
  // a temporary URL at the page level.
  photoStoragePath: string | null;
};

export type MortgageExpiryItem = {
  transactionId: string;
  propertyAddress: string;
  // "buyer" = the buyer's own mortgage offer on this purchase; "seller_onward"
  // = the seller's offer on the property they're buying onward.
  side: "buyer" | "seller_onward";
  // Possessive client label ("Ben and Molly's"), so the card names the people
  // rather than "Buyer's offer".
  clientLabel: string;
  expiryDate: Date;
  photoStoragePath: string | null;
  // Predicted exchange date (override ?? predicted) → the "how urgent" chip
  // (offer expiring + still far from exchange is the real worry).
  exchangeDate: Date | null;
};

// Hub card feed: provisional survey / lender-valuation bookings a BUYER logged
// on their portal (awaitingBookingConfirmation) that our side hasn't confirmed
// yet. The responsible confirmer is the agency agent on self-managed files and
// the progressor on outsourced ones — the same self_managed/outsourced split
// the attention list uses. Confirming (releaseProvisionalBooking) releases the
// held client emails. See docs/active/booking-reminders/00-plan.md.
export type BookingToConfirmItem = {
  completionId: string;
  transactionId: string;
  milestoneDefinitionId: string;
  code: "PM6" | "PM9";
  kind: "survey" | "valuation";
  propertyAddress: string;
  photoStoragePath: string | null;
  // The appointment date the buyer entered (always present — the portal forces
  // it for these steps). Null-safe for older rows.
  eventDate: Date | null;
  // First name of the client who logged it, or null if it can't be resolved.
  bookedByName: string | null;
};

export async function getBookingsToConfirm(vis: AgentVisibility, excludeTxIds: string[] = []): Promise<BookingToConfirmItem[]> {
  const txNested = buildTxNested(vis);
  // Agency viewers confirm their own self-managed files; internal staff confirm
  // outsourced files (scoped by txNested to admin=all / progressor=assigned).
  // agencyId only applies to agency viewers (internal staff carry null) — same
  // guard as the attention list's txLogFilter.
  const txFilter: Prisma.PropertyTransactionWhereInput = vis.internalMode
    ? { status: "active", serviceType: "outsourced", isDemo: false, ...txNested }
    : { agencyId: vis.agencyId, status: "active", serviceType: "self_managed", isDemo: false, ...txNested };

  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      awaitingBookingConfirmation: true,
      state: "complete",
      milestoneDefinition: { code: { in: ["PM6", "PM9"] } },
      transaction: {
        ...txFilter,
        ...(excludeTxIds.length ? { id: { notIn: excludeTxIds } } : {}),
      },
    },
    // Soonest appointment first — the one most likely to need action today.
    orderBy: { eventDate: "asc" },
    select: {
      id: true,
      eventDate: true,
      milestoneDefinitionId: true,
      confirmedByContactId: true,
      milestoneDefinition: { select: { code: true } },
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          photoStoragePath: true,
          contacts: { select: { id: true, name: true, roleType: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    const code = (r.milestoneDefinition.code === "PM6" ? "PM6" : "PM9") as "PM6" | "PM9";
    // Prefer the exact contact who logged it; else the sole buyer.
    const byId = r.confirmedByContactId
      ? r.transaction.contacts.find((c) => c.id === r.confirmedByContactId)
      : undefined;
    const buyers = r.transaction.contacts.filter((c) => c.roleType === "purchaser");
    const who = byId ?? (buyers.length === 1 ? buyers[0] : undefined);
    return {
      completionId: r.id,
      transactionId: r.transaction.id,
      milestoneDefinitionId: r.milestoneDefinitionId,
      code,
      kind: code === "PM6" ? ("valuation" as const) : ("survey" as const),
      propertyAddress: r.transaction.propertyAddress,
      photoStoragePath: r.transaction.photoStoragePath,
      eventDate: r.eventDate,
      bookedByName: who ? extractFirstName(who.name) : null,
    };
  });
}

// Hub card feed: client-supplied mortgage-offer expiries on active, not-yet-
// exchanged files in the viewer's scope, expiring within ~30 days (or recently
// lapsed). Same visibility rules as getExpiredHolds. Read-only surfacing of the
// same dates the property-file Overview card shows — so a lapsing offer is
// visible without opening every file. The stepped bell/push alerts are fired
// separately by the morning-digest cron (fireMortgageExpiryAlerts).
export async function getUpcomingMortgageExpiries(vis: AgentVisibility, excludeTxIds: string[] = []): Promise<MortgageExpiryItem[]> {
  const now = new Date();
  const todayMs = new Date().setUTCHours(0, 0, 0, 0);
  const horizon = new Date(todayMs + 30 * 86400000);
  const floor = new Date(todayMs - 60 * 86400000); // include recently-lapsed, not ancient dates
  const txNested = buildTxNested(vis);
  const base: Prisma.PropertyTransactionWhereInput = {
    ...txNested,
    status: "active",
    exchangedAt: null,
    // Don't repeat a file that's already in "Needs your attention".
    ...(excludeTxIds.length ? { id: { notIn: excludeTxIds } } : {}),
  };
  const txFilter: Prisma.PropertyTransactionWhereInput = vis.internalMode
    ? base
    : { ...base, agencyId: vis.agencyId };

  const rows = await prisma.clientMoveInfo.findMany({
    where: {
      transaction: txFilter,
      OR: [
        { mortgageOfferExpiry: { gte: floor, lte: horizon } },
        { onwardMortgageOfferExpiry: { gte: floor, lte: horizon } },
      ],
    },
    select: {
      side: true,
      mortgageOfferExpiry: true,
      onwardMortgageOfferExpiry: true,
      transaction: {
        select: {
          id: true, propertyAddress: true, photoStoragePath: true,
          expectedExchangeDate: true, overridePredictedDate: true,
          contacts: { select: { name: true, roleType: true } },
          // Active dismissals so we can drop just the dismissed offer date,
          // keyed by "<side>:<expiryISO>" — a renewed offer reappears.
          hubCardDismissals: {
            where: { cardKind: "mortgage_expiry", dismissedUntil: { gt: now } },
            select: { signature: true },
          },
        },
      },
    },
  });

  const items: MortgageExpiryItem[] = [];
  for (const r of rows) {
    const tx = r.transaction;
    const dismissed = new Set(tx.hubCardDismissals.map((d) => d.signature));
    const exchangeDate = tx.overridePredictedDate ?? tx.expectedExchangeDate ?? null;
    const inWindow = (d: Date | null): d is Date => d != null && d >= floor && d <= horizon;
    const label = (role: "purchaser" | "vendor", fallback: string) =>
      possessiveClientLabel(tx.contacts.filter((c) => c.roleType === role).map((c) => c.name), fallback);
    const push = (side: "buyer" | "seller_onward", date: Date, role: "purchaser" | "vendor", fallback: string) => {
      if (dismissed.has(`${side}:${date.toISOString().slice(0, 10)}`)) return;
      items.push({ transactionId: tx.id, propertyAddress: tx.propertyAddress, side, clientLabel: label(role, fallback), expiryDate: date, photoStoragePath: tx.photoStoragePath, exchangeDate });
    };
    if (r.side === "purchaser" && inWindow(r.mortgageOfferExpiry)) push("buyer", r.mortgageOfferExpiry, "purchaser", "The buyer's");
    if (r.side === "vendor" && inWindow(r.onwardMortgageOfferExpiry)) push("seller_onward", r.onwardMortgageOfferExpiry, "vendor", "The seller's");
  }
  items.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  return items;
}

export async function getExpiredHolds(vis: AgentVisibility): Promise<ExpiredHoldItem[]> {
  const now = new Date();
  const txNested = buildTxNested(vis);

  // Open hold periods whose planned date has passed, on transactions still
  // in on_hold status. Filter the parent tx via the nested visibility clause
  // so internal staff see their assigned files and agents see their agency.
  // Attention rule (founder, 2026-08-08): agency viewers only see holds
  // on files they progress themselves — outsourced files' holds surface
  // to the SP team instead. Internal paths already scoped by txNested.
  //
  // agencyId added same day (Law 7): the nested filter alone never
  // constrained the agency for agency viewers — a seeAll director with
  // no firmName resolved to { agentUserId: { not: null } }, which
  // matches other agencies' files. Mirrors getHubAttentionItems'
  // txLogFilter, which already carries agencyId.
  const holdTxFilter: Prisma.PropertyTransactionWhereInput = vis.internalMode
    ? { ...txNested, status: "on_hold" }
    : { ...txNested, status: "on_hold", serviceType: "self_managed", agencyId: vis.agencyId };

  const rows = await prisma.transactionHoldPeriod.findMany({
    where: {
      endedAt: null,
      plannedEndAt: { not: null, lt: now },
      transaction: holdTxFilter,
    },
    select: {
      transactionId: true,
      plannedEndAt: true,
      startedAt: true,
      reason: true,
      startedBy: { select: { name: true } },
      transaction: {
        select: {
          propertyAddress: true,
          photoStoragePath: true,
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
      reason: r.reason,
      placedByName: r.startedBy?.name ?? null,
      photoStoragePath: r.transaction.photoStoragePath,
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
  // Wins rotator (2026-09-18): the shout-about extras. Value/biggest come from
  // the same exchange rows the fastest-exchange pick already fetches; files
  // count is the distinct-transaction spread behind stepsConfirmedThisWeek.
  valueExchangedPence: number;
  biggestExchangePence: number | null;
  biggestExchangeAddress: string | null;
  stepsFilesThisWeek: number;
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
    exchangesLastMonth,
    completionsThisMonth,
    completionsLastMonth,
    fastestExchangeRows,
    stepRowsThisWeek,
    newFilesThisMonth,
  ] = await Promise.all([
    // 2026-07-03 correctness fix: distinct-file counts, not row counts.
    // Each exchange writes two rows (VM19 vendor + PM26 purchaser) and
    // each completion writes two (VM20 + PM27). Counting rows doubled
    // every wins-card number. Same pattern as getHubPipelineStages.
    //
    // Phase 4 (2026-09-18, PERF-13): the this-month exchange count is now
    // derived from fastestExchangeRows below (same filters, distinct
    // transaction ids) instead of a separate count query.
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
          select: { id: true, createdAt: true, propertyAddress: true, purchasePrice: true },
        },
      },
    }),
    // Any milestone confirmed in the last 7 days — this is the "steps
    // confirmed" number used by tier 3 / secondary metric. transactionId
    // (not a bare count) so the rotator can also say "across N files".
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: txWhere,
        completedAt: { gte: sevenDaysAgo },
        state: "complete",
        OR: roundScopedOR(activeRoundIds),
      },
      select: { transactionId: true },
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

  // Value exchanged + biggest exchange this month. Each exchange writes two
  // completion rows (VM19 vendor + PM26 purchaser), so dedupe by transaction
  // before summing — same distinct-file rule as the counts above.
  const seenExchangeTx = new Set<string>();
  let valueExchangedPence = 0;
  let biggestExchangePence: number | null = null;
  let biggestExchangeAddress: string | null = null;
  for (const row of fastestExchangeRows) {
    const tx = row.transaction;
    if (!tx || seenExchangeTx.has(tx.id)) continue;
    seenExchangeTx.add(tx.id);
    if (tx.purchasePrice == null) continue;
    valueExchangedPence += tx.purchasePrice;
    if (biggestExchangePence === null || tx.purchasePrice > biggestExchangePence) {
      biggestExchangePence = tx.purchasePrice;
      biggestExchangeAddress = tx.propertyAddress;
    }
  }

  // Phase 4 (PERF-13): distinct-file exchange count derived from the rows
  // already fetched above. seenExchangeTx adds every distinct transaction id
  // BEFORE the purchase-price guard, so its size equals what the dropped
  // propertyTransaction.count (some-matching-completion) returned.
  const exchangesThisMonth = seenExchangeTx.size;

  return {
    exchangesThisMonth,
    exchangesLastMonth,
    completionsThisMonth,
    completionsLastMonth,
    fastestExchangeDays,
    fastestExchangeAddress,
    stepsConfirmedThisWeek: stepRowsThisWeek.length,
    newFilesThisMonth,
    valueExchangedPence,
    biggestExchangePence,
    biggestExchangeAddress,
    stepsFilesThisWeek: new Set(stepRowsThisWeek.map((r) => r.transactionId)).size,
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
// A representative file for a pipeline stage — drives the property preview
// (thumbnail + address) on the "Pipeline at a glance" stage cards. Null when
// the stage is empty.
export type PipelineSample = {
  id: string;
  propertyAddress: string;
  photoStoragePath: string | null;
};

// The "+N more" bubble on a stage card: up to 5 further files, address-only
// (deliberately no photos — the bubble is a text menu).
export type PipelineMoreItem = {
  id: string;
  propertyAddress: string;
};

export type StageStatsNew = {
  count: number;
  oldestDays: number | null;
  newThisWeek: number;
  quietFiles: number;
};

// The old single "legals" bucket is split into three real conveyancing phases
// (chase-consolidation hub work, 2026-09-02): onboarding → searches →
// enquiries. A file sits in the FURTHEST phase either side has reached.
export type StageStatsOnboarding = {
  count: number;
  // Files still without the draft contract pack (VM7 / PM7).
  awaitingDraftPack: number;
  // Longest a file has been on the books in this stage (days since created).
  oldestDays: number | null;
};

export type StageStatsSearches = {
  count: number;
  // Searches ordered (PM8) but results (PM13) not yet in.
  awaitingResults: number;
  oldestDays: number | null;
};

export type StageStatsEnquiries = {
  count: number;
  // Files with an enquiry loop still open (tracker not yet closed).
  openLoops: number;
  oldestDays: number | null;
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

// Each stage carries a `sample` (a representative file) for the property
// preview on the new stage cards, on top of its existing stats.
export type HubPipelineStages = {
  new: StageStatsNew & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  onboarding: StageStatsOnboarding & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  searches: StageStatsSearches & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  enquiries: StageStatsEnquiries & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  ready: StageStatsReady & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  exchanging: StageStatsExchanging & { sample: PipelineSample | null; more: PipelineMoreItem[] };
  completed: StageStatsCompleted & { sample: PipelineSample | null; more: PipelineMoreItem[] };
};

// Phase-entry milestone codes — a file is bucketed into the furthest phase
// whose entry milestones (either side) it has reached. Onboarding = solicitor
// set-up through the draft contract pack; Searches = buyer's solicitor ordering
// searches / getting results; Enquiries = the enquiry-and-contract back-and-
// forth (also driven by the EnquiryTracker). Ready/Exchange/Completion use the
// gate + confirmation milestones. See getHubPipelineStages.
const ONBOARDING_CODES = ["VM3", "VM4", "VM5", "VM6", "VM7", "VM8", "VM9", "PM3", "PM4", "PM5", "PM6", "PM7"];
const SEARCHES_CODES = ["PM8", "PM13"];
const ENQUIRIES_CODES = ["VM10", "VM16", "VM17", "PM14", "PM20", "PM21", "PM22", "PM23", "PM24"];
const DRAFT_PACK_CODES = ["VM7", "PM7"];

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
  new: { count: 0, oldestDays: null, newThisWeek: 0, quietFiles: 0, sample: null, more: [] },
  onboarding: { count: 0, awaitingDraftPack: 0, oldestDays: null, sample: null, more: [] },
  searches: { count: 0, awaitingResults: 0, oldestDays: null, sample: null, more: [] },
  enquiries: { count: 0, openLoops: 0, oldestDays: null, sample: null, more: [] },
  ready: { count: 0, overdueToExchange: 0, medianDaysToExchange: null, totalValueLocked: null, sample: null, more: [] },
  exchanging: { count: 0, completingThisWeek: 0, medianDaysSinceExchange: null, totalValueClosing: null, sample: null, more: [] },
  completed: { count: 0, totalValueClosed: null, medianDaysToComplete: null, slaHitRate: null, sample: null, more: [] },
};

// Representative file for a bucket's preview: the oldest on the books, so the
// card shows a meaningful, stable pick (not whatever the query happened to
// order first). Null for an empty bucket.
function pickSample(
  files: Array<{ id: string; propertyAddress: string; photoStoragePath: string | null; createdAt: Date }>,
): PipelineSample | null {
  if (files.length === 0) return null;
  const oldest = files.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
  return { id: oldest.id, propertyAddress: oldest.propertyAddress, photoStoragePath: oldest.photoStoragePath };
}

// The next files after the featured sample, oldest-first, for the card's
// "+N more" bubble. Capped at 5 — beyond that the bubble links to Files.
function pickMore(
  files: Array<{ id: string; propertyAddress: string; photoStoragePath: string | null; createdAt: Date }>,
): PipelineMoreItem[] {
  return [...files]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(1, 6)
    .map((f) => ({ id: f.id, propertyAddress: f.propertyAddress }));
}

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
  // One load of every definition → an id→code map, so the active-pool
  // bucketing can classify a file by the CODES it has completed (not just the
  // ready gates). Cheap: ~48 rows, unfiltered.
  const allDefs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));
  const idsForCodes = (codes: string[]) => allDefs.filter((d) => codes.includes(d.code)).map((d) => d.id);
  const vm18Id = allDefs.find((d) => d.code === "VM18")?.id;
  const pm25Id = allDefs.find((d) => d.code === "PM25")?.id;
  const exchangeDefIds = idsForCodes(["VM19", "PM26"]);
  const completionDefIds = idsForCodes(["VM20", "PM27"]);

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
        propertyAddress: true,
        photoStoragePath: true,
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
        createdAt: true,
        completionDate: true,
        purchasePrice: true,
        propertyAddress: true,
        photoStoragePath: true,
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
        propertyAddress: true,
        photoStoragePath: true,
        // Enquiries are tracker-driven since the enquiries rework — an open
        // tracker (closedAt null) means the enquiry loop is still live.
        enquiryTracker: { select: { closedAt: true } },
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

  // Bucket the active-not-yet-exchanging pool into the four pre-exchange phases
  // by the FURTHEST phase either side has reached: ready > enquiries > searches
  // > onboarding > new. Mutually exclusive — a file appears in exactly one.
  const newFiles: typeof activePool = [];
  const onboardingFiles: typeof activePool = [];
  const searchesFiles: typeof activePool = [];
  const enquiriesFiles: typeof activePool = [];
  const readyFiles: typeof activePool = [];

  for (const tx of activePool) {
    const completeCodes = new Set(
      tx.milestoneCompletions.map((m) => codeById.get(m.milestoneDefinitionId)).filter((c): c is string => !!c),
    );
    const reached = (codes: string[]) => codes.some((c) => completeCodes.has(c));
    const vm18Done = completeCodes.has("VM18");
    const pm25Done = completeCodes.has("PM25");
    const enquiriesReached = !!tx.enquiryTracker || reached(ENQUIRIES_CODES);

    if (vm18Done && pm25Done) readyFiles.push(tx);
    else if (enquiriesReached) enquiriesFiles.push(tx);
    else if (reached(SEARCHES_CODES)) searchesFiles.push(tx);
    else if (reached(ONBOARDING_CODES)) onboardingFiles.push(tx);
    else newFiles.push(tx);
  }

  const oldestDays = (files: typeof activePool) =>
    files.length > 0 ? Math.max(...files.map((t) => daysBetween(now, t.createdAt))) : null;
  const hasCode = (tx: (typeof activePool)[number], codes: string[]) =>
    tx.milestoneCompletions.some((m) => { const c = codeById.get(m.milestoneDefinitionId); return !!c && codes.includes(c); });

  // NEW stats
  const newOldest = oldestDays(newFiles);
  const newThisWeek = newFiles.filter((t) => t.createdAt >= sevenDaysAgo).length;
  const quietFiles = newFiles.filter((t) => !t.lastActivityAt || t.lastActivityAt < sevenDaysAgo).length;

  // ONBOARDING stats — how many are still waiting on the draft contract pack.
  const onboardingAwaitingPack = onboardingFiles.filter((t) => !hasCode(t, DRAFT_PACK_CODES)).length;

  // SEARCHES stats — ordered (PM8) but results (PM13) not yet in.
  const searchesAwaitingResults = searchesFiles.filter((t) => hasCode(t, ["PM8"]) && !hasCode(t, ["PM13"])).length;

  // ENQUIRIES stats — files whose enquiry loop is still open.
  const enquiriesOpenLoops = enquiriesFiles.filter((t) => t.enquiryTracker && t.enquiryTracker.closedAt == null).length;

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
      sample: pickSample(newFiles),
      more: pickMore(newFiles),
    },
    onboarding: {
      count: onboardingFiles.length,
      awaitingDraftPack: onboardingAwaitingPack,
      oldestDays: oldestDays(onboardingFiles),
      sample: pickSample(onboardingFiles),
      more: pickMore(onboardingFiles),
    },
    searches: {
      count: searchesFiles.length,
      awaitingResults: searchesAwaitingResults,
      oldestDays: oldestDays(searchesFiles),
      sample: pickSample(searchesFiles),
      more: pickMore(searchesFiles),
    },
    enquiries: {
      count: enquiriesFiles.length,
      openLoops: enquiriesOpenLoops,
      oldestDays: oldestDays(enquiriesFiles),
      sample: pickSample(enquiriesFiles),
      more: pickMore(enquiriesFiles),
    },
    ready: {
      count: readyFiles.length,
      overdueToExchange: readyOverdue,
      medianDaysToExchange,
      totalValueLocked,
      sample: pickSample(readyFiles),
      more: pickMore(readyFiles),
    },
    exchanging: {
      count: exchangingRows.length,
      completingThisWeek,
      medianDaysSinceExchange,
      totalValueClosing,
      sample: pickSample(exchangingRows),
      more: pickMore(exchangingRows),
    },
    completed: {
      count: completedRows.length,
      totalValueClosed,
      medianDaysToComplete,
      slaHitRate,
      sample: pickSample(completedRows),
      more: pickMore(completedRows),
    },
  };
}

// ── Weekly exchange forecast (5 weeks) ───────────────────────────────────────

export type WeekBucket = {
  label: string;
  count: number;
  isCurrentWeek: boolean;
  // Heat-band hover (2026-09-18): the count is printed on the chart now, so
  // the popup shows what the chart can't — which properties and what they're
  // worth to the agency. feesPence is the property-file Fees card's number
  // (commission + referrals − our fee), NOT the sale price (Ellis,
  // 2026-09-18) — the forecast is "what you'll earn", not "what's changing
  // hands".
  feesPence: number;
  files: { address: string; feePence: number }[];
};

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
    select: {
      overridePredictedDate: true, expectedExchangeDate: true, propertyAddress: true,
      // Per-file fee inputs — same sum as the property-file Fees card
      // (calculateFileFeesPence). Commission + referrals − our fee.
      purchasePrice: true, agentFeeAmount: true, agentFeePercent: true,
      referralFee: true, brokerReferralFee: true, onwardBrokerReferralFee: true,
      serviceType: true, freeOnExchange: true, firstOutsourcedFree: true,
      assignedUser: { select: { clientType: true, legacyFee: true } },
      agency: { select: { feeTier: true, legacyOutsourcedFeePence: true } },
    },
  });

  return weeks.map(({ start, end, label, isCurrentWeek }) => {
    const inWeek = transactions.filter((tx) => {
      const d = tx.overridePredictedDate ?? tx.expectedExchangeDate;
      return d && d >= start && d <= end;
    });
    const files = inWeek
      .map((tx) => ({
        address: tx.propertyAddress,
        feePence: calculateFileFeesPence({
          purchasePrice: tx.purchasePrice,
          agentFeeAmount: tx.agentFeeAmount,
          agentFeePercent: tx.agentFeePercent,
          referralFee: tx.referralFee,
          brokerReferralFee: tx.brokerReferralFee,
          onwardBrokerReferralFee: tx.onwardBrokerReferralFee,
          serviceType: tx.serviceType,
          freeOnExchange: tx.freeOnExchange,
          firstOutsourcedFree: tx.firstOutsourcedFree,
          assignedUser: tx.assignedUser,
          agencyOverride: tx.agency,
        }),
      }))
      // Biggest earner first, so the popup's top three are the ones worth knowing.
      .sort((a, b) => b.feePence - a.feePence);
    return {
      label,
      isCurrentWeek,
      count: inWeek.length,
      feesPence: files.reduce((s, f) => s + f.feePence, 0),
      files,
    };
  });
}

// ── Service split ─────────────────────────────────────────────────────────────

export async function getHubServiceSplit(vis: AgentVisibility): Promise<{
  selfManaged: number;
  outsourced: number;
  // Internal (platform) extras — undefined for agency-scoped viewers, who never
  // see our fee income or a cross-agency breakdown.
  feeSelfPence?: number;
  feeOutsourcedPence?: number;
  topAgencies?: { name: string; count: number }[];
  agencyCount?: number;
}> {
  const txWhere = buildTxWhere(vis);

  // Agency-scoped viewer: just the two counts (the card shows their own book +
  // a time-saved line). No fees, no cross-agency data.
  if (!vis.internalMode) {
    const [selfManaged, outsourced] = await Promise.all([
      prisma.propertyTransaction.count({ where: { ...txWhere, status: "active", serviceType: "self_managed" } }),
      prisma.propertyTransaction.count({ where: { ...txWhere, status: "active", serviceType: "outsourced" } }),
    ]);
    return { selfManaged, outsourced };
  }

  // Internal (platform) view: one pass over active files → counts, our fee income
  // by service type, and the agencies making up the pipeline.
  const files = await prisma.propertyTransaction.findMany({
    where: { ...txWhere, status: "active" },
    select: {
      ...FEE_INPUT_SELECT,
      agencyId: true,
      agency: { select: { name: true, feeTier: true, legacyOutsourcedFeePence: true } },
    },
  });

  let selfManaged = 0, outsourced = 0, feeSelfPence = 0, feeOutsourcedPence = 0;
  const byAgency = new Map<string, { name: string; count: number }>();
  for (const tx of files) {
    const fee = calculateProgressionFeePence(toFeeInput(tx));
    if (tx.serviceType === "self_managed") { selfManaged++; feeSelfPence += fee; }
    else { outsourced++; feeOutsourcedPence += fee; }
    const cur = byAgency.get(tx.agencyId) ?? { name: tx.agency?.name ?? "Unknown agency", count: 0 };
    cur.count++;
    byAgency.set(tx.agencyId, cur);
  }
  const topAgencies = [...byAgency.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  return { selfManaged, outsourced, feeSelfPence, feeOutsourcedPence, topAgencies, agencyCount: byAgency.size };
}

// ── Attention items (active/overdue reminders) ────────────────────────────────

export type HubAttentionItem = {
  id: string;
  urgency: "escalated" | "overdue" | "due_today";
  reminderName: string;
  transaction: { id: string; propertyAddress: string; photoStoragePath: string | null };
  nextDueDate: Date;
  // Effective predicted exchange date (override ?? predicted), null if none.
  // Feeds the internal "most time-critical" ranking so files close to exchange
  // rise above routine early-stage nudges.
  exchangeDate: Date | null;
  // 2026-07-13 (Chunk 8): manual-escalation trio - all null when the
  // engine auto-flipped, or when the item isn't escalated at all. Read
  // by the tooltip on the Sale Health / Attention list's Escalated pill.
  escalationReason: string | null;
  escalatedAt: Date | null;
  escalatedByName: string | null;
  // Hub chase split-button (2026-09-18): the pending chase task (null when
  // the engine hasn't opened one yet - chaseNowFromLogAction creates it on
  // demand) and the reminder's target milestone, for the confirm-done flow.
  // Both null on the synthetic exchange-overdue ("xovr-") items.
  taskId: string | null;
  targetMilestoneCode: string | null;
  // Inline chase drawer on the hub (2026-09-18): everything the ChaseDrawer
  // needs so Chase opens right there instead of navigating to the file.
  // Empty/null on the synthetic exchange-overdue items (no Chase button).
  chaseCount: number;
  contacts: ChaseContact[];
  vendorSolicitor: SolicitorRef | null;
  purchaserSolicitor: SolicitorRef | null;
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
  // Attention rule (founder, 2026-08-08): agencies only see attention
  // items for files THEY progress. Outsourced files' chasing is the SP
  // team's job, so their reminders surface internally, not on the
  // agency's hub. Internal paths are untouched (already scoped to
  // outsourced / assigned files by buildTxNested).
  const txLogFilter: Prisma.PropertyTransactionWhereInput =
    vis.internalMode
      // Internal staff only chase OUTSOURCED files (admin_all = every outsourced
      // file; assigned = the SP's own). Never surface an agency's in-house
      // self-managed chasing here. (admin_all's txNested already adds this; the
      // guard also enforces it for the assigned branch, matching reminders.ts.)
      ? { status: "active", serviceType: "outsourced", isDemo: false, ...txNested }
      // isDemo:false — the demo file's seeded reminders must not appear as hub
      // attention items on the agency's real hub.
      : { agencyId: vis.agencyId, status: "active", serviceType: "self_managed", isDemo: false, ...txNested };

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
      // targetMilestoneCode + the transaction pause/contact fields below feed
      // resolveAutopilot (is the auto-chase pipeline still handling this?).
      reminderRule: { select: { name: true, targetMilestoneCode: true } },
      transaction: {
        select: {
          id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, overridePredictedDate: true,
          agencyId: true, clientEmailsPaused: true, vendorSolicitorEmailsPaused: true, purchaserSolicitorEmailsPaused: true,
          // Full contact + solicitor shapes (mirroring getAgentReminderLogs) so
          // the hub's inline chase drawer gets real recipients, not just the
          // email fields resolveAutopilot needs.
          contacts: { select: { id: true, name: true, roleType: true, email: true, phone: true, portalToken: true, unsubscribedAt: true } },
          vendorSolicitorFirm: { select: { name: true } },
          vendorSolicitorContact: { select: { id: true, name: true, email: true, phone: true, secondaryEmail: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          purchaserSolicitorContact: { select: { id: true, name: true, email: true, phone: true, secondaryEmail: true } },
        },
      },
      // status + snoozedUntil + chase fields all needed by classifyReminder.
      status: true,
      snoozedUntil: true,
      chaseTasks: {
        where: { status: "pending" },
        select: {
          id: true, // hub chase split-button: mark-chased / done / snooze act on this task
          status: true, priority: true, chaseCount: true,
          fallbackKind: true, // resolveAutopilot: a handed-back chase is "manual".
          // 2026-07-13 (Chunk 8): needed to build the Escalated tooltip.
          escalationReason: true,
          escalatedAt: true,
          escalatedBy: { select: { name: true } },
        },
        take: 1,
      },
    },
  });

  // "With the system, not yet raised to a person" doesn't count: resolve each
  // reminder's autopilot state and drop the ones the auto-chase pipeline is
  // still handling. An escalated reminder always resolves to "manual", so it's
  // kept. Same split the Reminders work queue uses for needs-you vs on-autopilot.
  const agencyIds = [...new Set(logs.map((l) => l.transaction.agencyId).filter((a): a is string => !!a))];
  const [solSettings, agencies] = await Promise.all([
    prisma.solicitorChaseSettings.findFirst({ select: { enabledByDefault: true } }),
    agencyIds.length
      ? prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, chaseEmailsEnabled: true, solicitorChaseEnabled: true } })
      : Promise.resolve([]),
  ]);
  const flags: AutopilotFlags = {
    clientChaseEnabled: process.env.CLIENT_CHASE_ENABLED === "true",
    solicitorGlobalEnabled: solSettings?.enabledByDefault ?? false,
    agencyClientChase: new Map(agencies.map((a) => [a.id, a.chaseEmailsEnabled])),
    agencySolicitorChase: new Map(agencies.map((a) => [a.id, a.solicitorChaseEnabled])),
  };
  const autopilot = resolveAutopilot(logs, flags);

  // Apply the canonical classifier — chased rows (chaseCount >= 1) live
  // in Coming up and shouldn't surface on the hub attention card. Only
  // escalated / overdue / due_today land here.
  const items: HubAttentionItem[] = logs
    .map((log) => {
      // On autopilot (system chasing, not escalated) → not a human's job yet.
      if (autopilot.get(log.id)?.kind === "auto") return null;
      const bucket = classifyReminder(log, now);
      if (bucket !== "escalated" && bucket !== "overdue" && bucket !== "due_today") return null;
      const task = log.chaseTasks[0];
      return {
        id: log.id,
        urgency: bucket as HubAttentionItem["urgency"],
        reminderName: log.reminderRule.name.replace(/^Chase:\s*/i, ""),
        transaction: { id: log.transaction.id, propertyAddress: log.transaction.propertyAddress, photoStoragePath: log.transaction.photoStoragePath },
        nextDueDate: log.nextDueDate,
        exchangeDate: log.transaction.overridePredictedDate ?? log.transaction.expectedExchangeDate ?? null,
        escalationReason: task?.escalationReason ?? null,
        escalatedAt: task?.escalatedAt ?? null,
        escalatedByName: task?.escalatedBy?.name ?? null,
        // Explicit widening: chaseTasks[0] is typed non-optional by the
        // indexed access, but is undefined at runtime when no task is open.
        taskId: (task?.id ?? null) as string | null,
        targetMilestoneCode: (log.reminderRule.targetMilestoneCode ?? null) as string | null,
        chaseCount: task?.chaseCount ?? 0,
        // Project down to the client-safe ChaseContact shape (drops
        // portalToken/unsubscribedAt, which only resolveAutopilot needs).
        contacts: log.transaction.contacts.map((c): ChaseContact => ({
          id: c.id, name: c.name, roleType: c.roleType, email: c.email, phone: c.phone,
        })),
        vendorSolicitor: (log.transaction.vendorSolicitorContact
          ? { ...log.transaction.vendorSolicitorContact, firm: log.transaction.vendorSolicitorFirm ?? null }
          : null) as SolicitorRef | null,
        purchaserSolicitor: (log.transaction.purchaserSolicitorContact
          ? { ...log.transaction.purchaserSolicitorContact, firm: log.transaction.purchaserSolicitorFirm ?? null }
          : null) as SolicitorRef | null,
      };
    })
    .filter((x): x is HubAttentionItem => x !== null);

  // Enquiries no longer surface here. Open enquiry loops (including stalled ones)
  // live on the dedicated Enquiries triage page, which owns confirming whose
  // court the ball is in — so they stop inflating this attention count. The
  // normal reminder flow still chases REACHING enquiries (VM10 / PM14 etc.);
  // once the tracker opens, the triage page takes over.
  // See docs/active/enquiries-triage/00-spec.md.

  // Scenario D: an exchange whose predicted date has passed while the file has
  // gone quiet surfaces as an overdue attention item, so a stuck file can't
  // silently drop off the hub. A file that's still moving self-heals — each
  // milestone confirm refreshes expectedExchangeDate to a future prediction
  // (lib/services/exchange-prediction.ts) so it never reaches this window.
  // See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).
  const overdueCandidates = await prisma.propertyTransaction.findMany({
    where: {
      AND: [
        txLogFilter,
        {
          exchangedAt: null,
          // Skip files whose exchange nag is snoozed into the future.
          OR: [
            { exchangeReminderSnoozedUntil: null },
            { exchangeReminderSnoozedUntil: { lte: now } },
          ],
        },
        {
          OR: [
            { overridePredictedDate: { lt: now } },
            { overridePredictedDate: null, expectedExchangeDate: { lt: now } },
          ],
        },
      ],
    },
    select: {
      id: true,
      propertyAddress: true,
      photoStoragePath: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      exchangeReminderSnoozedUntil: true,
      exchangedAt: true,
      milestoneCompletions: {
        where: { state: "complete", completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
    },
  });
  for (const tx of overdueCandidates) {
    const { stuck, passedDate } = isExchangeOverdueStuck({
      exchangedAt: tx.exchangedAt,
      expectedExchangeDate: tx.expectedExchangeDate,
      overridePredictedDate: tx.overridePredictedDate,
      lastMilestoneConfirmedAt: tx.milestoneCompletions[0]?.completedAt ?? null,
      snoozedUntil: tx.exchangeReminderSnoozedUntil,
      now,
    });
    if (!stuck || !passedDate) continue;
    items.push({
      id: `xovr-${tx.id}`,
      urgency: "overdue",
      reminderName: "Exchange date passed",
      transaction: {
        id: tx.id,
        propertyAddress: tx.propertyAddress,
        photoStoragePath: tx.photoStoragePath,
      },
      nextDueDate: passedDate,
      exchangeDate: tx.overridePredictedDate ?? tx.expectedExchangeDate ?? passedDate,
      escalationReason: "Exchange date passed and the file's gone quiet",
      escalatedAt: null,
      escalatedByName: null,
      taskId: null,
      targetMilestoneCode: null,
      chaseCount: 0,
      contacts: [],
      vendorSolicitor: null,
      purchaserSolicitor: null,
    });
  }

  // Internal staff get a "most time-critical" ranking: keep urgency as the base
  // weight (escalated highest — something's actively going wrong), but lift
  // files close to (or past) exchange so a near-exchange file beats a routine
  // early-stage nudge. Value/fee deliberately plays no part. Agency viewers keep
  // the original urgency-then-due-date order until this proves itself internally.
  if (vis.internalMode) {
    const rank = (it: HubAttentionItem): number => {
      const base = it.urgency === "escalated" ? 100 : it.urgency === "overdue" ? 60 : 30;
      let proximity = 0;
      if (it.exchangeDate) {
        const days = Math.floor((it.exchangeDate.getTime() - now.getTime()) / 86400000);
        proximity = days < 0 ? 90 : days <= 7 ? 80 : days <= 14 ? 50 : days <= 30 ? 25 : 0;
      }
      return base + proximity;
    };
    items.sort((a, b) => {
      const d = rank(b) - rank(a);
      return d !== 0 ? d : new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
    });
  } else {
    const order = { escalated: 0, overdue: 1, due_today: 2 };
    items.sort((a, b) => {
      const d = order[a.urgency] - order[b.urgency];
      return d !== 0 ? d : new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
    });
  }

  return items;
}

// ── Today's diary ────────────────────────────────────────────────────────────

export type DiaryItem = {
  type: "exchange" | "completion";
  transactionId: string;
  address: string;
  photoStoragePath: string | null;
  // done      = already exchanged / completed (info, no action)
  // ready     = both gates confirmed, not yet done (actionable pill)
  // not_ready = due today but the gates aren't both confirmed (info)
  status: "done" | "ready" | "not_ready";
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
        id: true, propertyAddress: true, photoStoragePath: true,
        expectedExchangeDate: true, overridePredictedDate: true,
        // Needed for the placeholder check + status below.
        twelveWeekTarget: true, activeBuyerRoundId: true, exchangedAt: true,
      },
    }),
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: { in: ["active", "completed"] },
        completionDate: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, propertyAddress: true, photoStoragePath: true, completionDate: true, exchangedAt: true, status: true },
    }),
  ]);

  const isToday = (d: Date | null) => d !== null && toUKDateStr(d) === todayStr;

  // Completions first (higher significance); deduplicate by transactionId
  const seen = new Set<string>();
  const items: DiaryItem[] = [];
  for (const tx of completions) {
    if (!isToday(tx.completionDate)) continue;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    // done once the file is completed; ready to confirm once exchanged; else
    // still awaiting exchange (can't complete before contracts exchange).
    const status: DiaryItem["status"] =
      tx.status === "completed" ? "done" : tx.exchangedAt ? "ready" : "not_ready";
    items.push({ type: "completion", transactionId: tx.id, address: tx.propertyAddress, photoStoragePath: tx.photoStoragePath, status });
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
    // A manual override is the source of truth when set — it wins on every other
    // surface (override ?? expected). So when one exists, judge "today" on the
    // override ALONE and never fall back to the raw system prediction. Without
    // this, a file whose forecast was pushed out via override (e.g. recalibrated
    // or chain-synced to a later date) but whose own expectedExchangeDate still
    // happens to land today would wrongly surface in the diary.
    if (tx.overridePredictedDate != null) {
      if (isToday(tx.overridePredictedDate)) exchangeFireQueue.push(tx);
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

  // Status for the fired exchange items: already exchanged = done; both gate
  // steps (VM18 vendor + PM25 purchaser) confirmed = ready to action; else the
  // file is due today but not yet ready. One bulk, round-scoped lookup.
  const fireIds = exchangeFireQueue.map((t) => t.id);
  const gatesByTx = new Map<string, Set<string>>();
  if (fireIds.length > 0) {
    const gateDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM18", "PM25"] } },
      select: { id: true, code: true },
    });
    const gateCodeById = new Map(gateDefs.map((d) => [d.id, d.code]));
    const txByIdF = new Map(exchangeFireQueue.map((t) => [t.id, t]));
    const gateComps = await prisma.milestoneCompletion.findMany({
      where: {
        transactionId: { in: fireIds },
        state: "complete",
        milestoneDefinitionId: { in: gateDefs.map((d) => d.id) },
      },
      select: { transactionId: true, milestoneDefinitionId: true, buyerRoundId: true },
    });
    for (const c of gateComps) {
      const tx = txByIdF.get(c.transactionId);
      if (!tx) continue;
      const code = gateCodeById.get(c.milestoneDefinitionId);
      if (!code) continue;
      // Round-scope: purchaser codes must match the active round.
      if (code.startsWith("PM") && c.buyerRoundId !== tx.activeBuyerRoundId) continue;
      const set = gatesByTx.get(c.transactionId) ?? new Set<string>();
      set.add(code);
      gatesByTx.set(c.transactionId, set);
    }
  }
  for (const tx of exchangeFireQueue) {
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    const gates = gatesByTx.get(tx.id) ?? new Set<string>();
    const status: DiaryItem["status"] = tx.exchangedAt
      ? "done"
      : gates.has("VM18") && gates.has("PM25")
        ? "ready"
        : "not_ready";
    items.push({ type: "exchange", transactionId: tx.id, address: tx.propertyAddress, photoStoragePath: tx.photoStoragePath, status });
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
  // When the file started waiting to be assigned an SP (outsourcedAt, falling
  // back to createdAt for files born outsourced before that column existed).
  waitingSince: Date;
  photoStoragePath: string | null;
};

export async function getHubUnassignedFiles(vis: AgentVisibility): Promise<HubUnassignedFile[]> {
  if (vis.internalMode !== "admin_all") return [];
  const files = await prisma.propertyTransaction.findMany({
    where: { assignedUserId: null, status: "active", serviceType: "outsourced" },
    take: 20,
    select: {
      id: true,
      propertyAddress: true,
      createdAt: true,
      outsourcedAt: true,
      photoStoragePath: true,
      agency: { select: { name: true } },
    },
  });
  // Sort by how long each has been waiting (longest first). Done in JS off the
  // effective "waiting since" so switched files (outsourcedAt later than
  // createdAt) rank by their real wait, not their file age.
  return files
    .map((f) => ({
      id: f.id,
      propertyAddress: f.propertyAddress,
      agencyName: f.agency?.name ?? null,
      createdAt: f.createdAt,
      waitingSince: f.outsourcedAt ?? f.createdAt,
      photoStoragePath: f.photoStoragePath,
    }))
    .sort((a, b) => a.waitingSince.getTime() - b.waitingSince.getTime());
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
  photoStoragePath: string | null;
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
      select: { id: true, propertyAddress: true, photoStoragePath: true, agency: { select: { name: true } } },
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
      photoStoragePath: tx?.photoStoragePath ?? null,
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
  photoStoragePath: string | null;
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
    // Attention rule (founder, 2026-08-08): agency viewers only see
    // chain-setup prompts on files they progress themselves.
    txWhere = vis.firmName
      ? { status: "active", chainSetupPending: true, serviceType: "self_managed", agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { status: "active", chainSetupPending: true, serviceType: "self_managed", agencyId: vis.agencyId };
  } else {
    txWhere = { status: "active", chainSetupPending: true, serviceType: "self_managed", agencyId: vis.agencyId, agentUserId: vis.userId };
  }

  const txs = await prisma.propertyTransaction.findMany({
    where: txWhere,
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      propertyAddress: true,
      updatedAt: true,
      photoStoragePath: true,
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
    photoStoragePath: t.photoStoragePath,
  }));
}

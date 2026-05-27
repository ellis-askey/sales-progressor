import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AgentVisibility } from "./agent";
import type { FlagKind } from "./problem-detection";
import { toUKDateStr } from "@/lib/utils";
import { classifyReminder } from "@/lib/reminders/classify";

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
  if (vis.internalMode === "admin_all") return {};
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
  if (vis.internalMode === "admin_all") return {};
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
    // Active txns where expectedExchangeDate falls in next 7 days AND VM19/PM26 not yet complete
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        expectedExchangeDate: { gte: now, lte: in7Days },
        NOT: {
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            },
          },
        },
      },
      select: { id: true },
    }),

    // ── Coming up: completing this week ───────────────────────────────────────
    // Active txns where completionDate falls in next 7 days AND VM20/PM27 not yet complete
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        completionDate: { gte: now, lte: in7Days },
        NOT: {
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
            },
          },
        },
      },
      select: { id: true },
    }),

    // ── Coming up: closing this month (purchase price sum) ────────────────────
    // Active txns where expectedExchangeDate is in current calendar month, VM19/PM26 not complete
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth },
        NOT: {
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
            },
          },
        },
      },
      select: { purchasePrice: true },
    }),

    // ── Stalled: active, not exchanged, no genuine milestone in 14 days ───────
    // "Genuine" = reconciledAtExchange AND reconciledAtClaim both false. For
    // reconciled-at-claim completions, we instead check eventDate (the real-world
    // date the agent backdated to). A file with recent backdated activity is NOT stalled.
    prisma.propertyTransaction.findMany({
      where: {
        ...txWhere,
        status: "active",
        // No genuine (non-reconciled) completion in last 14 days
        milestoneCompletions: {
          none: {
            state: "complete",
            completedAt: { gte: fourteenDaysAgo },
            reconciledAtExchange: false,
            reconciledAtClaim: false,
          },
        },
        // AND no recent backdated (reconciledAtClaim) completion either — eventDate within 14 days counts as activity
        AND: [
          {
            milestoneCompletions: {
              none: {
                state: "complete",
                reconciledAtClaim: true,
                eventDate: { gte: fourteenDaysAgo },
              },
            },
          },
        ],
        // Not already exchanged
        NOT: {
          milestoneCompletions: {
            some: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
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

  let where: Prisma.PropertyTransactionWhereInput;

  if (filter === "exchanging-next-30-days") {
    // Mirrors hub.ts:63–72 — active files with expected/override exchange date in next 30 days
    where = {
      ...txWhere,
      status: "active",
      OR: [
        { expectedExchangeDate: { gte: now, lte: in30Days } },
        { overridePredictedDate: { gte: now, lte: in30Days } },
      ],
    };
  } else if (filter === "exchanging-this-week") {
    // Mirrors hub.ts:83–98
    where = {
      ...txWhere,
      status: "active",
      expectedExchangeDate: { gte: now, lte: in7Days },
      NOT: {
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
          },
        },
      },
    };
  } else if (filter === "completing-this-week") {
    // Mirrors hub.ts:101–117
    where = {
      ...txWhere,
      status: "active",
      completionDate: { gte: now, lte: in7Days },
      NOT: {
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
          },
        },
      },
    };
  } else {
    // closing-this-month — mirrors hub.ts:119–136
    where = {
      ...txWhere,
      status: "active",
      expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth },
      NOT: {
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
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

  const where: Prisma.PropertyTransactionWhereInput = {
    ...txWhere,
    status: "active",
    OR: [
      { expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth } },
      { overridePredictedDate: { gte: startOfMonth, lte: endOfMonth } },
    ],
    NOT: {
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
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

  const [thisMonth, lastMonth] = await Promise.all([
    prisma.milestoneCompletion.count({
      where: {
        transaction: txWhere,
        milestoneDefinitionId: { in: exchangeDefIds },
        completedAt: { gte: startOfThisMonth },
        state: "complete",
      },
    }),
    prisma.milestoneCompletion.count({
      where: {
        transaction: txWhere,
        milestoneDefinitionId: { in: exchangeDefIds },
        completedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        state: "complete",
      },
    }),
  ]);

  const percent =
    lastMonth > 0
      ? Math.min(200, Math.round((thisMonth / lastMonth) * 100))
      : null;

  return { thisMonth, lastMonth, percent };
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

  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      status: "active",
      OR: [
        { overridePredictedDate: { gte: now, lte: cutoff } },
        { expectedExchangeDate: { gte: now, lte: cutoff } },
      ],
      NOT: {
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
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
      select: { id: true, propertyAddress: true, expectedExchangeDate: true, overridePredictedDate: true },
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
  for (const tx of exchanges) {
    const exDate = tx.overridePredictedDate ?? tx.expectedExchangeDate;
    if (!isToday(exDate)) continue;
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

  const [recentComm, recentMilestone] = await Promise.all([
    prisma.outboundMessage.findFirst({
      where: { transaction: txFilter, type: { in: ["outbound", "inbound"] } },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        method: true,
        content: true,
        createdAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
    prisma.milestoneCompletion.findFirst({
      where: { transaction: txFilter, state: "complete" },
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

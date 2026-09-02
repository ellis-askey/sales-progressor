import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { AgentVisibility } from "./agent";
import type { FlagKind } from "./problem-detection";
import { toUKDateStr } from "@/lib/utils";
import { possessiveClientLabel } from "@/lib/updates-copy";
import { classifyReminder } from "@/lib/reminders/classify";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { isExchangeOverdueStuck } from "@/lib/services/exchange-prediction";

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
        OR: [
          { expectedExchangeDate: { gte: startOfToday, lte: endOfToday } },
          { overridePredictedDate: { gte: startOfToday, lte: endOfToday } },
        ],
      },
    }),
    prisma.propertyTransaction.count({
      where: {
        ...txWhere, isDemo: false, status: "active",
        OR: [
          { expectedExchangeDate: { gte: now, lte: in7Days } },
          { overridePredictedDate: { gte: now, lte: in7Days } },
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
          expectedExchangeDate: true, overridePredictedDate: true,
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
  // The engaged-then-quiet contact on a file, most-engaged first, or null.
  const quietClientName = (contacts: { id: string; name: string }[]): string | null => {
    const candidates = contacts
      .map((c) => ({ c, v: visitByContact.get(c.id) }))
      .filter((x): x is { c: { id: string; name: string }; v: { days: number; lastDay: string | null } } => {
        if (!x.v || !x.v.lastDay || x.v.days < ENGAGED_DAYS) return false;
        const daysSince = Math.floor((now.getTime() - new Date(`${x.v.lastDay}T00:00:00Z`).getTime()) / 86400000);
        return daysSince >= QUIET_DAYS;
      })
      .sort((a, b) => b.v.days - a.v.days);
    return candidates[0] ? firstName(candidates[0].c.name) : null;
  };

  // One row per file — the earliest-detected (longest-standing) flag wins.
  const seen = new Set<string>();
  const items: GoneQuietItem[] = [];
  for (const f of flags) {
    const tx = f.transaction;
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    // Name the client only when there's a single buyer (unambiguous).
    const buyers = tx.contacts.filter((c) => c.roleType === "purchaser");
    const who = buyers.length === 1 ? firstName(buyers[0].name) : null;
    let subtext: string;
    const lastContactDays = tx.lastActivityAt
      ? Math.floor((now.getTime() - new Date(tx.lastActivityAt).getTime()) / 86400000)
      : null;
    if (f.kind === "portal_gone_quiet") {
      // Prefer the specific person who went quiet; fall back to the sole buyer,
      // then a generic label.
      const named = quietClientName(tx.contacts) ?? who;
      subtext = `${named ?? "A client"} was checking the portal regularly, then stopped.`;
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
    });
  }
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

export type HubPipelineStages = {
  new: StageStatsNew;
  onboarding: StageStatsOnboarding;
  searches: StageStatsSearches;
  enquiries: StageStatsEnquiries;
  ready: StageStatsReady;
  exchanging: StageStatsExchanging;
  completed: StageStatsCompleted;
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
  new: { count: 0, oldestDays: null, newThisWeek: 0, quietFiles: 0 },
  onboarding: { count: 0, awaitingDraftPack: 0, oldestDays: null },
  searches: { count: 0, awaitingResults: 0, oldestDays: null },
  enquiries: { count: 0, openLoops: 0, oldestDays: null },
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
    },
    onboarding: {
      count: onboardingFiles.length,
      awaitingDraftPack: onboardingAwaitingPack,
      oldestDays: oldestDays(onboardingFiles),
    },
    searches: {
      count: searchesFiles.length,
      awaitingResults: searchesAwaitingResults,
      oldestDays: oldestDays(searchesFiles),
    },
    enquiries: {
      count: enquiriesFiles.length,
      openLoops: enquiriesOpenLoops,
      oldestDays: oldestDays(enquiriesFiles),
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
      ? { status: "active", ...txNested }
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
      reminderRule: { select: { name: true } },
      transaction: { select: { id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, overridePredictedDate: true } },
      // status + snoozedUntil + chase fields all needed by classifyReminder.
      status: true,
      snoozedUntil: true,
      chaseTasks: {
        where: { status: "pending" },
        select: {
          status: true, priority: true, chaseCount: true,
          // 2026-07-13 (Chunk 8): needed to build the Escalated tooltip.
          escalationReason: true,
          escalatedAt: true,
          escalatedBy: { select: { name: true } },
        },
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
      };
    })
    .filter((x): x is HubAttentionItem => x !== null);

  // Enquiries rework: a stalled enquiries loop (no movement in 3 weeks) surfaces
  // as an escalated attention item too, using the same visibility scoping.
  const stalled = await prisma.enquiryTracker.findMany({
    where: { escalatedAt: { not: null }, closedAt: null, transaction: txLogFilter },
    select: {
      id: true,
      escalatedAt: true,
      transaction: { select: { id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, overridePredictedDate: true } },
    },
  });
  for (const t of stalled) {
    if (!t.escalatedAt) continue;
    items.push({
      id: `enq-${t.id}`,
      urgency: "escalated",
      reminderName: "Enquiries stalled",
      transaction: { id: t.transaction.id, propertyAddress: t.transaction.propertyAddress, photoStoragePath: t.transaction.photoStoragePath },
      nextDueDate: t.escalatedAt,
      exchangeDate: t.transaction.overridePredictedDate ?? t.transaction.expectedExchangeDate ?? null,
      escalationReason: "No movement in 3 weeks",
      escalatedAt: t.escalatedAt,
      escalatedByName: null,
    });
  }

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
        id: true, propertyAddress: true,
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
      select: { id: true, propertyAddress: true, completionDate: true, exchangedAt: true, status: true },
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
    items.push({ type: "completion", transactionId: tx.id, address: tx.propertyAddress, status });
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
    items.push({ type: "exchange", transactionId: tx.id, address: tx.propertyAddress, status });
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

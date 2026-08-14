// lib/services/transactions.ts — Sprint 6: includes tenure/purchaseType/purchasePrice fields

import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType } from "@prisma/client";
import { scopeTransactionWhere, scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { toUKDateStr } from "@/lib/utils";
import { activeElapsedMs } from "@/lib/services/hold-duration";
import { stampTrialState } from "@/lib/services/trial";
import { assertCanCreateFile } from "@/lib/billing/payment-block";
import { recordEvent } from "@/lib/command/events/write";
import { roundScopedOR, contactRoundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { normaliseAddressString } from "@/lib/utils/address";

export async function listTransactions(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null },
  scope?: AccessScope
) {
  const now = new Date();
  const totalMilestones = await prisma.milestoneDefinition.count({ where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } } }); // exclude retired enquiry steps
  let whereClause: Record<string, unknown>;
  // Internal staff path: scope overrides all agencyId-based filtering.
  // Agent callers pass no scope — they hit the existing branches below unchanged.
  if (scope) {
    whereClause = { ...scopeTransactionWhere(scope), status: { not: "draft" } };
  } else if (opts?.allAgentFiles) {
    whereClause = opts.firmName
      ? { agencyId, agentUser: { firmName: opts.firmName } }
      : { agencyId, agentUserId: { not: null } };
    whereClause = { ...whereClause, status: { not: "draft" } };
  } else if (agentUserId) {
    whereClause = { agencyId, agentUserId, status: { not: "draft" } };
  } else {
    whereClause = { agencyId, progressedBy: "progressor", status: { not: "draft" } };
  }
  // Phase-3 (a)-CLASS restructure: pre-load activeBuyerRoundId for every
  // in-scope tx. The OR clauses on the cross-tx aggregates below use
  // `buyerRoundId IN [activeRoundIds]` — which is equivalent to "row's
  // buyerRoundId === its own tx's activeBuyerRoundId" because BuyerRound
  // ids are globally unique cuids.
  const activeRoundIds = await loadActiveRoundIds(whereClause);

  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true, image: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      // Phase-3: scope Contact list reads to the active round + file-level.
      // Pre-Phase-3 the cross-tx include returned every contact regardless
      // of which buyer round attached them — relisted files showed both
      // the previous buyer AND the active buyer in list summaries.
      contacts: {
        where: { OR: contactRoundScopedOR(activeRoundIds) },
        select: { id: true, name: true, roleType: true },
      },
      // Phase-3: scope MilestoneCompletion to active round + file-level
      // (vendor). Pre-Phase-3 the archived buyer's most-recent PM could
      // win as "lastMilestoneAt"/activity-verb on a relisted file. Now
      // only the active round's PM completions can.
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(activeRoundIds) },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: {
          completedAt: true,
          milestoneDefinition: { select: { name: true } },
        },
      },
      _count: {
        select: {
          // Phase-3: count completes for active round + file-level only.
          // Cumulative inflation from archived rounds resolved.
          milestoneCompletions: { where: { state: "complete", OR: roundScopedOR(activeRoundIds) } },
        },
      },
      chaseTasks: {
        // Phase-3 belt-and-braces: PR 1 cancellation makes old-round
        // pending tasks status="cancelled" so the status="pending" filter
        // already excludes them. Adding the OR scope keeps this in
        // lockstep with the per-tx ChaseTask read in PR 6.
        where: { status: "pending", OR: roundScopedOR(activeRoundIds) },
        select: {
          id: true,
          dueDate: true,
          priority: true,
          reminderLog: { select: { reminderRule: { select: { name: true, targetMilestoneCode: true } } } },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
      // Latest outbound message — joined for the activity-verb chip.
      // Phase-3: scope to active round + file-level so a fall-through
      // buyer's last chase email doesn't drive the live row's verb chip.
      communications: {
        where: { OR: roundScopedOR(activeRoundIds) },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, channel: true, method: true, purpose: true, type: true, isAutomated: true },
      },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
      // Pass 3 B3: anchor "elapsed weeks" / on-track signal on the active
      // round's createdAt, not the file's. A relisted file is 8 weeks old
      // but the active sale just started; without this the freshly-relisted
      // tx reads "8 weeks elapsed / off track" from minute one.
      activeBuyerRound: { select: { createdAt: true } },
    },
  });

  return transactions.map((tx) => {
    const overdueTasks = tx.chaseTasks.filter((t) => new Date(t.dueDate) < now);
    const escalatedTasks = overdueTasks.filter((t) => t.priority === "escalated");
    const nextTask = tx.chaseTasks[0];
    const lastMilestone = tx.milestoneCompletions[0] ?? null;
    const lastMilestoneAt = lastMilestone?.completedAt ?? null;
    const lastComm = tx.communications[0] ?? null;

    const nextActionLabel = nextTask
      ? nextTask.reminderLog.reminderRule.name
      : null;

    // daysStuckOnMilestone: frozen while the file is on hold — otherwise it
    // would keep ticking even though no work can happen. Pass 3c: also
    // clamped forward to the active round's createdAt — a relist IS
    // progress; surviving vendor VMs from before the relist would
    // otherwise read "stuck N days" on a fresh sale.
    const stuckRef = lastMilestoneAt && tx.activeBuyerRound?.createdAt
      ? new Date(Math.max(new Date(lastMilestoneAt).getTime(), tx.activeBuyerRound.createdAt.getTime()))
      : lastMilestoneAt;
    const daysStuckOnMilestone = stuckRef && tx.status !== "on_hold"
      ? Math.floor((Date.now() - new Date(stuckRef).getTime()) / 86400000)
      : null;

    // Activity-verb derivation — timestamp-only "latest event wins" rule (v1).
    // Picks the more recent of (milestone confirmation, outbound message),
    // maps to a human verb. Falls back to null when no signal — client renders
    // generic "Active Nd ago" in that case. Phase 4 review may add precedence
    // weighting if chips read noisy in production (per 2026-05-13 brief).
    const milestoneTs = lastMilestoneAt ? new Date(lastMilestoneAt).getTime() : 0;
    const commTs      = lastComm?.createdAt ? new Date(lastComm.createdAt).getTime() : 0;
    let lastActivityType: string | null = null;
    let lastActivityLabel: string | null = null;
    if (milestoneTs > 0 && milestoneTs >= commTs) {
      lastActivityType = "milestone";
      const name = lastMilestone?.milestoneDefinition?.name;
      lastActivityLabel = name ? `${name} confirmed` : "Step confirmed";
    } else if (commTs > 0 && lastComm) {
      if (lastComm.type === "internal_note") {
        lastActivityType = "note"; lastActivityLabel = "Note added";
      } else if (lastComm.type === "inbound") {
        lastActivityType = "inbound"; lastActivityLabel = "Reply received";
      } else if (lastComm.purpose === "chase" && !lastComm.isAutomated) {
        lastActivityType = "chase"; lastActivityLabel = "Chase sent";
      } else if (lastComm.method === "email" || lastComm.channel === "email") {
        lastActivityType = "email"; lastActivityLabel = "Email sent";
      } else if (lastComm.method === "sms" || lastComm.channel === "sms") {
        lastActivityType = "sms"; lastActivityLabel = "SMS sent";
      } else if (lastComm.method === "whatsapp") {
        lastActivityType = "whatsapp"; lastActivityLabel = "WhatsApp sent";
      } else if (lastComm.method === "phone" || lastComm.method === "voicemail") {
        lastActivityType = "call"; lastActivityLabel = "Call logged";
      } else {
        lastActivityType = "comm"; lastActivityLabel = "Message sent";
      }
    }

    const completedCount = tx._count.milestoneCompletions;
    // Active-only elapsed: hold periods are subtracted so the on-track
    // signal doesn't drift while the file is paused. Pass 3 B3: anchored
    // on activeBuyerRound.createdAt when present (relist resets the clock).
    const elapsedAnchor = tx.activeBuyerRound?.createdAt ?? tx.createdAt;
    const daysElapsed = activeElapsedMs(new Date(elapsedAnchor), {
      status: tx.status,
      holdPeriods: tx.holdPeriods,
    }) / 86400000;
    const weeksElapsed = daysElapsed / 7;
    const actualPercent = Math.min(100, (completedCount / totalMilestones) * 100);
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = actualPercent - expectedPercent;
    // on_hold short-circuit: time isn't ticking so at_risk/off_track signal
    // isn't meaningful. UI renders a neutral "On hold" pill instead.
    const onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold" =
      tx.status === "on_hold" ? "on_hold" :
      completedCount === 0 ? "unknown" :
      diff >= -10 ? "on_track" :
      diff >= -25 ? "at_risk" :
      "off_track";

    const { chaseTasks: _c, _count: _cnt, agentFeeAmount, agentFeePercent, referralFee, ...rest } = tx;
    return {
      ...rest,
      agentFeeAmount: agentFeeAmount != null ? Number(agentFeeAmount) : null,
      agentFeePercent: agentFeePercent != null ? Number(agentFeePercent) : null,
      referralFee: referralFee != null ? Number(referralFee) : null,
      health: {
        pendingOverdueTasks: overdueTasks.length,
        escalatedTasks: escalatedTasks.length,
        lastActivityAt: tx.lastActivityAt,
        lastActivityType,
        lastActivityLabel,
        nextActionLabel,
        nextMilestoneLabel: null as string | null,
        daysStuckOnMilestone,
        onTrack,
      },
    };
  });
}

// Section 2 (per-sale Contact scoping, 2026-06-05): on the live single-
// transaction read, purchaser contacts must be scoped to the active
// BuyerRound so that fell-through buyers (e.g. Marcus on a relisted file)
// stop showing as live Purchaser contacts. Non-purchaser roles (vendor,
// solicitor, broker, other) are file-level by design and pass through
// unchanged. Transactions with no active BuyerRound (legacy / draft files
// pre-dating Phase 1) keep all purchaser contacts visible — the filter is
// a no-op there.
//
// Aggregate / list / cross-tx reads (listTransactions, hub, analytics,
// completions) are NOT scoped here — see docs/TODO.md Phase-3 (a)-CLASS arc.
function scopeContactsToActiveRound<
  T extends {
    activeBuyerRound: { id: string } | null;
    contacts: Array<{ roleType: string; buyerRoundId: string | null }>;
  }
>(tx: T): T {
  const activeRoundId = tx.activeBuyerRound?.id ?? null;
  tx.contacts = tx.contacts.filter((c) => {
    if (c.roleType !== "purchaser") return true;
    if (activeRoundId === null) return true;
    return c.buyerRoundId === activeRoundId;
  });
  return tx;
}

export async function getTransaction(id: string, agencyId: string) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id, agencyId },
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true, image: true } },
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, portalToken: true, lastVisitedPortalAt: true, unsubscribedAt: true, createdAt: true, buyerRoundId: true } },
      vendorSolicitorFirm: { select: { id: true, name: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      referredFirm: { select: { id: true, name: true } },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
      // Phase 1 commit 8 — round-aware UI surfaces. activeBuyerRound
      // drives the round banner (visibility + label); buyerRounds
      // drives the archived-round drawer. Both selects are minimal
      // — anything heavier (the round's PM rows, its comms, its VM
      // snapshot) is fetched separately by the archived-round view
      // when the user opens it.
      // Pass 3b — createdAt added so file-detail surfaces (calculateProgress,
      // computeEffectiveStartDate) can anchor "weeks elapsed" / "off track"
      // on the active sale's start, not the file's. Mirrors the list-view
      // fix in listTransactions / listTransactionsByScope.
      activeBuyerRound: { select: { id: true, roundNumber: true, status: true, createdAt: true } },
      buyerRounds: {
        select: { id: true, roundNumber: true, status: true, archivedAt: true, fallThroughReason: true, createdAt: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  return tx ? scopeContactsToActiveRound(tx) : null;
}

export async function getTransactionByScope(id: string, scope: AccessScope) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, id),
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true, image: true } },
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, portalToken: true, lastVisitedPortalAt: true, unsubscribedAt: true, createdAt: true, buyerRoundId: true } },
      vendorSolicitorFirm: { select: { id: true, name: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      referredFirm: { select: { id: true, name: true } },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
      // Phase 1 commit 8 — round-aware UI surfaces. activeBuyerRound
      // drives the round banner (visibility + label); buyerRounds
      // drives the archived-round drawer. Both selects are minimal
      // — anything heavier (the round's PM rows, its comms, its VM
      // snapshot) is fetched separately by the archived-round view
      // when the user opens it.
      // Pass 3b — createdAt added so file-detail surfaces (calculateProgress,
      // computeEffectiveStartDate) can anchor "weeks elapsed" / "off track"
      // on the active sale's start, not the file's. Mirrors the list-view
      // fix in listTransactions / listTransactionsByScope.
      activeBuyerRound: { select: { id: true, roundNumber: true, status: true, createdAt: true } },
      buyerRounds: {
        select: { id: true, roundNumber: true, status: true, archivedAt: true, fallThroughReason: true, createdAt: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  return tx ? scopeContactsToActiveRound(tx) : null;
}

export async function countTransactionsByStatus(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null },
  scope?: AccessScope
) {
  let whereClause: Record<string, unknown>;
  if (scope) {
    whereClause = { ...scopeTransactionWhere(scope), status: { not: "draft" } };
  } else if (opts?.allAgentFiles) {
    whereClause = opts.firmName
      ? { agencyId, agentUser: { firmName: opts.firmName } }
      : { agencyId, agentUserId: { not: null } };
    whereClause = { ...whereClause, status: { not: "draft" } };
  } else if (agentUserId) {
    whereClause = { agencyId, agentUserId, status: { not: "draft" } };
  } else {
    whereClause = { agencyId, progressedBy: "progressor", status: { not: "draft" } };
  }
  const counts = await prisma.propertyTransaction.groupBy({
    by: ["status"],
    where: whereClause,
    _count: true,
  });

  const result = { active: 0, on_hold: 0, completed: 0, withdrawn: 0 };
  counts.forEach((c) => {
    result[c.status as keyof typeof result] = c._count;
  });
  return result;
}

export async function listTransactionsByScope(scope: AccessScope) {
  const now = new Date();
  const totalMilestones = await prisma.milestoneDefinition.count({ where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } } }); // exclude retired enquiry steps
  const base = scopeTransactionWhere(scope);
  const whereClause: Record<string, unknown> =
    scope.kind === "agency"
      ? { ...base, progressedBy: "progressor", status: { not: "draft" } }
      : { ...base, status: { not: "draft" } };

  // Phase-3: same two-step round-id pre-load + OR scoping as listTransactions.
  const activeRoundIds = await loadActiveRoundIds(whereClause);

  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, image: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      contacts: {
        where: { OR: contactRoundScopedOR(activeRoundIds) },
        select: { id: true, name: true, roleType: true },
      },
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(activeRoundIds) },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
      _count: {
        select: {
          milestoneCompletions: { where: { state: "complete", OR: roundScopedOR(activeRoundIds) } },
        },
      },
      chaseTasks: {
        where: { status: "pending", OR: roundScopedOR(activeRoundIds) },
        select: {
          id: true,
          dueDate: true,
          priority: true,
          reminderLog: { select: { reminderRule: { select: { name: true, targetMilestoneCode: true } } } },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
      // Pass 3 B3: anchor elapsed-time on the active round (see listTransactions).
      activeBuyerRound: { select: { createdAt: true } },
    },
  });

  return transactions.map((tx) => {
    const overdueTasks = tx.chaseTasks.filter((t) => new Date(t.dueDate) < now);
    const escalatedTasks = overdueTasks.filter((t) => t.priority === "escalated");
    const nextTask = tx.chaseTasks[0];
    const lastMilestoneAt = tx.milestoneCompletions[0]?.completedAt ?? null;

    const nextActionLabel = nextTask
      ? nextTask.reminderLog.reminderRule.name
      : null;

    // Frozen while on hold (see listTransactions for context).
    const daysStuckOnMilestone = lastMilestoneAt && tx.status !== "on_hold"
      ? Math.floor((Date.now() - new Date(lastMilestoneAt).getTime()) / 86400000)
      : null;

    const completedCount = tx._count.milestoneCompletions;
    // Active-only elapsed: hold periods are subtracted so the on-track
    // signal doesn't drift while the file is paused. Pass 3 B3: anchored
    // on activeBuyerRound.createdAt when present (relist resets the clock).
    const elapsedAnchor = tx.activeBuyerRound?.createdAt ?? tx.createdAt;
    const daysElapsed = activeElapsedMs(new Date(elapsedAnchor), {
      status: tx.status,
      holdPeriods: tx.holdPeriods,
    }) / 86400000;
    const weeksElapsed = daysElapsed / 7;
    const actualPercent = Math.min(100, (completedCount / totalMilestones) * 100);
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = actualPercent - expectedPercent;
    // on_hold short-circuit: time isn't ticking so at_risk/off_track signal
    // isn't meaningful. UI renders a neutral "On hold" pill instead.
    const onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold" =
      tx.status === "on_hold" ? "on_hold" :
      completedCount === 0 ? "unknown" :
      diff >= -10 ? "on_track" :
      diff >= -25 ? "at_risk" :
      "off_track";

    const { chaseTasks: _c, _count: _cnt, agentFeeAmount, agentFeePercent, referralFee, ...rest } = tx;
    return {
      ...rest,
      agentFeeAmount: agentFeeAmount != null ? Number(agentFeeAmount) : null,
      agentFeePercent: agentFeePercent != null ? Number(agentFeePercent) : null,
      referralFee: referralFee != null ? Number(referralFee) : null,
      health: {
        pendingOverdueTasks: overdueTasks.length,
        escalatedTasks: escalatedTasks.length,
        lastActivityAt: tx.lastActivityAt,
        nextActionLabel,
        nextMilestoneLabel: null as string | null,
        daysStuckOnMilestone,
        onTrack,
      },
    };
  });
}

export async function countTransactionsByScope(scope: AccessScope) {
  const base = scopeTransactionWhere(scope);
  const whereClause: Record<string, unknown> =
    scope.kind === "agency"
      ? { ...base, progressedBy: "progressor", status: { not: "draft" } }
      : { ...base, status: { not: "draft" } };

  const counts = await prisma.propertyTransaction.groupBy({
    by: ["status"],
    where: whereClause,
    _count: true,
  });

  const result = { active: 0, on_hold: 0, completed: 0, withdrawn: 0 };
  counts.forEach((c) => {
    result[c.status as keyof typeof result] = c._count;
  });
  return result;
}

export type ForecastMonth = {
  label: string;        // e.g. "May 2026"
  year: number;
  month: number;        // 0-indexed
  transactions: { id: string; propertyAddress: string; forecastDate: Date; serviceType: "self_managed" | "outsourced" | null }[];
};

export async function getExchangeForecast(agencyId: string, agentUserId?: string, opts?: { allAgentFiles?: boolean; firmName?: string | null }, scope?: AccessScope): Promise<ForecastMonth[]> {
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const baseWhere = scope ? scopeTransactionWhere(scope) : { agencyId, ...agentFilter };
  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      ...baseWhere,
      status: "active",
      OR: [
        { overridePredictedDate: { not: null } },
        { expectedExchangeDate: { not: null } },
      ],
      // PHASE 1 (a)-CLASS ACCEPTED: exchangedAt is the canonical
      // "has this file exchanged?" source of truth (stamped atomically
      // on VM19/PM26 confirmation in billing-trigger.ts). This
      // milestoneCompletions NOT filter is a secondary check; the
      // relist precondition exchangedAt IS NULL means relisted files
      // can't have a satisfying VM19/PM26 row anyway. Cross-tx Prisma
      // limitation accepted; restructure deferred to Phase 2 if the
      // primary exchangedAt check ever stops being canonical.
      NOT: {
        milestoneCompletions: {
          some: {
            state: "complete",
            milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
          },
        },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      overridePredictedDate: true,
      expectedExchangeDate: true,
      serviceType: true,
    },
    orderBy: [{ overridePredictedDate: "asc" }, { expectedExchangeDate: "asc" }],
  });

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Rolling 12-month window: current month through current+11. Cutoff is the
  // first day of the 13th month; files with forecastDate < cutoff are in.
  const cutoff = new Date(now.getFullYear(), now.getMonth() + 12, 1);

  const mapped = transactions
    .map((tx) => ({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      forecastDate: (tx.overridePredictedDate ?? tx.expectedExchangeDate)!,
      serviceType: tx.serviceType,
    }))
    .filter((tx) => tx.forecastDate >= windowStart && tx.forecastDate < cutoff)
    .sort((a, b) => a.forecastDate.getTime() - b.forecastDate.getTime());

  // Always-12 contract: build the skeleton first so empty months have a slot
  // and consumers can render a fixed-width forecast horizon. Disabled-empty
  // pill state is rendered in components/transactions/ForecastStrip.tsx.
  const months: ForecastMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      year: d.getFullYear(),
      month: d.getMonth(),
      transactions: [],
    });
  }
  const indexByKey = new Map<string, number>(months.map((m, i) => [`${m.year}-${m.month}`, i]));

  for (const tx of mapped) {
    const key = `${tx.forecastDate.getFullYear()}-${tx.forecastDate.getMonth()}`;
    const idx = indexByKey.get(key);
    if (idx !== undefined) months[idx].transactions.push(tx);
  }

  return months;
}

export type PostExchangeTransaction = {
  id: string;
  propertyAddress: string;
  completionDate: Date | null;
  purchasers: string[];
};

export type PostExchangeGroup = {
  label: string;
  urgency: "overdue" | "this_week" | "next_week" | "later" | "no_date";
  transactions: PostExchangeTransaction[];
};

export async function getExchangedNotCompleting(agencyId: string, agentUserId?: string, opts?: { allAgentFiles?: boolean; firmName?: string | null }, scope?: AccessScope): Promise<PostExchangeGroup[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26", "VM20", "PM27"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM19" || d.code === "PM26").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM20" || d.code === "PM27").map((d) => d.id);

  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const baseWhere = scope ? scopeTransactionWhere(scope) : { agencyId, ...agentFilter };

  // Phase-3: scope cross-tx Contact + MC reads to active round + file-level.
  const txWhere = { ...baseWhere, status: "active" as const };
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      // Phase-3: "this file has an exchange completion on the ACTIVE round
      // OR vendor file-level" — restores the original semantic intent of
      // the (a)-CLASS comment ("exchangedAt is canonical"). A relisted
      // file's archived buyer's PM26 no longer satisfies this filter.
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinitionId: { in: exchangeDefIds },
          OR: roundScopedOR(activeRoundIds),
        },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      contacts: {
        where: { OR: contactRoundScopedOR(activeRoundIds) },
        select: { name: true, roleType: true },
      },
      milestoneCompletions: {
        where: {
          state: "complete",
          milestoneDefinitionId: { in: completionDefIds },
          OR: roundScopedOR(activeRoundIds),
        },
        select: { id: true },
      },
    },
  });

  const exchanged = candidates
    .filter((tx) => tx.milestoneCompletions.length === 0)
    .map((tx) => ({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      completionDate: tx.completionDate,
      purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
    }));

  if (exchanged.length === 0) return [];

  const now = new Date();
  const todayStr = toUKDateStr(now);
  const in7Str = toUKDateStr(new Date(now.getTime() + 7 * 86400000));
  const in14Str = toUKDateStr(new Date(now.getTime() + 14 * 86400000));

  const groups: Record<PostExchangeGroup["urgency"], PostExchangeTransaction[]> = {
    overdue: [],
    this_week: [],
    next_week: [],
    later: [],
    no_date: [],
  };

  for (const tx of exchanged) {
    if (!tx.completionDate) { groups.no_date.push(tx); continue; }
    const dStr = toUKDateStr(tx.completionDate);
    if (dStr < todayStr) groups.overdue.push(tx);
    else if (dStr < in7Str) groups.this_week.push(tx);
    else if (dStr < in14Str) groups.next_week.push(tx);
    else groups.later.push(tx);
  }

  const result: PostExchangeGroup[] = [];
  if (groups.overdue.length)    result.push({ label: "Overdue / completing today", urgency: "overdue",   transactions: groups.overdue });
  if (groups.this_week.length)  result.push({ label: "Completing this week",        urgency: "this_week", transactions: groups.this_week });
  if (groups.next_week.length)  result.push({ label: "Completing next week",        urgency: "next_week", transactions: groups.next_week });
  if (groups.later.length)      result.push({ label: "Completing later",            urgency: "later",     transactions: groups.later });
  if (groups.no_date.length)    result.push({ label: "No completion date set",      urgency: "no_date",   transactions: groups.no_date });

  return result;
}

export type PostExchangeTransactionDetailed = {
  id: string;
  propertyAddress: string;
  completionDate: Date | null;
  purchasePrice: number | null;
  purchasers: string[];
  vendors: string[];
  assignedUserName: string | null;
  vendorSolicitorFirmName: string | null;
  purchaserSolicitorFirmName: string | null;
};

export type PostExchangeGroupDetailed = {
  label: string;
  urgency: "overdue" | "this_week" | "next_week" | "later" | "no_date";
  transactions: PostExchangeTransactionDetailed[];
};

export async function getCompletingFilesDetailed(scope: AccessScope): Promise<PostExchangeGroupDetailed[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26", "VM20", "PM27"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM19" || d.code === "PM26").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM20" || d.code === "PM27").map((d) => d.id);

  // Phase-3: same two-step pattern as getExchangedNotCompleting.
  const txWhere = {
    ...scopeTransactionWhere(scope),
    status: "active" as const,
    progressedBy: "progressor" as const,
  };
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere,
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinitionId: { in: exchangeDefIds },
          OR: roundScopedOR(activeRoundIds),
        },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      assignedUser: { select: { name: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: {
        where: { OR: contactRoundScopedOR(activeRoundIds) },
        select: { name: true, roleType: true },
      },
      milestoneCompletions: {
        where: {
          state: "complete",
          milestoneDefinitionId: { in: completionDefIds },
          OR: roundScopedOR(activeRoundIds),
        },
        select: { id: true },
      },
    },
  });

  const exchanged = candidates
    .filter((tx) => tx.milestoneCompletions.length === 0)
    .map((tx) => ({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      completionDate: tx.completionDate,
      purchasePrice: tx.purchasePrice,
      purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
      vendors: tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name),
      assignedUserName: tx.assignedUser?.name ?? null,
      vendorSolicitorFirmName: tx.vendorSolicitorFirm?.name ?? null,
      purchaserSolicitorFirmName: tx.purchaserSolicitorFirm?.name ?? null,
    }));

  if (exchanged.length === 0) return [];

  const now = new Date();
  const todayStr = toUKDateStr(now);
  const in7Str = toUKDateStr(new Date(now.getTime() + 7 * 86400000));
  const in14Str = toUKDateStr(new Date(now.getTime() + 14 * 86400000));

  const groups: Record<PostExchangeGroupDetailed["urgency"], PostExchangeTransactionDetailed[]> = {
    overdue: [], this_week: [], next_week: [], later: [], no_date: [],
  };

  for (const tx of exchanged) {
    if (!tx.completionDate) { groups.no_date.push(tx); continue; }
    const dStr = toUKDateStr(tx.completionDate);
    if (dStr < todayStr) groups.overdue.push(tx);
    else if (dStr < in7Str) groups.this_week.push(tx);
    else if (dStr < in14Str) groups.next_week.push(tx);
    else groups.later.push(tx);
  }

  const result: PostExchangeGroupDetailed[] = [];
  if (groups.overdue.length)   result.push({ label: "Overdue / completing today", urgency: "overdue",   transactions: groups.overdue });
  if (groups.this_week.length) result.push({ label: "Completing this week",       urgency: "this_week", transactions: groups.this_week });
  if (groups.next_week.length) result.push({ label: "Completing next week",       urgency: "next_week", transactions: groups.next_week });
  if (groups.later.length)     result.push({ label: "Completing later",           urgency: "later",     transactions: groups.later });
  if (groups.no_date.length)   result.push({ label: "No completion date set",     urgency: "no_date",   transactions: groups.no_date });

  return result;
}

export type CreateTransactionInput = {
  propertyAddress: string;
  agencyId: string;
  assignedUserId?: string;
  agentUserId?: string | null;
  progressedBy?: "progressor" | "agent";
  expectedExchangeDate?: Date | null;
  // Admin-only override for migrating historical files. When set, createdAt
  // is persisted as the supplied date and the 12-week target is anchored
  // to it (so a 6-week-old migrated file has its target 6 weeks from now,
  // not 12). Caller is responsible for verifying admin role before passing.
  createdAt?: Date;
  purchasePrice?: number | null;
  tenure?: Tenure | null;
  isShareOfFreehold?: boolean;
  purchaseType?: PurchaseType | null;
  notes?: string | null;
  vendorSolicitorFirmId?: string | null;
  vendorSolicitorContactId?: string | null;
  purchaserSolicitorFirmId?: string | null;
  purchaserSolicitorContactId?: string | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  agentFeeIsVatInclusive?: boolean | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
  brokerFirmId?: string | null;
  brokerContactId?: string | null;
  brokerReferralFee?: number | null;
  purchaserBrokerReferral?: boolean;
  // True when the file is being created via the admin Migrate Sale page.
  // Excludes the row from milestone-velocity analytics — backdated
  // completedAt timestamps would pollute averages otherwise.
  isMigrated?: boolean;
};

// Build a chaseRuleSnapshot from the current ReminderRule rows. Forward-only
// semantics: Settings edits to ReminderRule apply to NEW transactions only;
// existing transactions keep their snapshot. The cron reads timing from the
// transaction's snapshot, falling back to live ReminderRule only when the
// snapshot is missing or malformed. Migration backfilled snapshots for
// pre-existing transactions; this function seeds them at creation time
// from here on.
async function buildChaseRuleSnapshot(): Promise<Record<string, {
  graceDays: number;
  repeatEveryDays: number;
  useEventDate: boolean;
  requiresExchangeReady: boolean;
  anchorMilestoneCode: string | null;
}>> {
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { not: null } },
    select: {
      targetMilestoneCode: true,
      graceDays: true,
      repeatEveryDays: true,
      useEventDate: true,
      requiresExchangeReady: true,
      anchorMilestone: { select: { code: true } },
    },
  });
  const out: Record<string, {
    graceDays: number;
    repeatEveryDays: number;
    useEventDate: boolean;
    requiresExchangeReady: boolean;
    anchorMilestoneCode: string | null;
  }> = {};
  for (const r of rules) {
    if (!r.targetMilestoneCode) continue;
    out[r.targetMilestoneCode] = {
      graceDays: r.graceDays,
      repeatEveryDays: r.repeatEveryDays,
      useEventDate: r.useEventDate,
      requiresExchangeReady: r.requiresExchangeReady,
      anchorMilestoneCode: r.anchorMilestone?.code ?? null,
    };
  }
  return out;
}

export async function createTransaction(input: CreateTransactionInput) {
  // Belt-and-braces postcode normalisation at the service layer. Every caller
  // (server actions, API routes, seeds, external integrations) hits this
  // path, so postcodes always land uppercase in the DB regardless of whether
  // the caller remembered to normalise. Idempotent — an already-normalised
  // address passes through unchanged. Guarded by "8 Goodwins Mead" bug 2026-07-02.
  const normalisedAddress = normaliseAddressString(input.propertyAddress);

  // Anchor the 12-week target to createdAt when supplied (admin migration),
  // otherwise to now (standard create). Same date drives expectedExchangeDate.
  const anchor = input.createdAt ?? new Date();
  const twelveWeekTarget = new Date(anchor);
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  const autoExchangeDate = new Date(anchor);
  autoExchangeDate.setDate(autoExchangeDate.getDate() + 84);

  const chaseRuleSnapshot = await buildChaseRuleSnapshot();

  const newTx = await prisma.$transaction(async (tx) => {
    // Payments: refuse new files if the agency has an overdue failed payment
    // (paymentFailedAt + 7d <= now AND newFileCreationBlockedAt set). Throws
    // PaymentBlockedError which the caller surfaces as a "update your card"
    // UX message. Existing files keep running regardless — block is strictly
    // on NEW file creation. See lib/billing/payment-block.ts.
    await assertCanCreateFile(input.agencyId, tx);

    // Stamp the frozen-trial state. If this is the agency's first-ever
    // PropertyTransaction, Agency.firstSubmissionAt is set inside this same
    // tx; the returned boolean is persisted on the new row and NEVER
    // recomputed. Atomic with the create below to avoid two parallel
    // first-time creates both claiming to be the anchor file.
    const freeOnExchange = await stampTrialState(input.agencyId, tx);

    const created = await tx.propertyTransaction.create({
    data: {
      propertyAddress: normalisedAddress,
      agencyId: input.agencyId,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      chaseRuleSnapshot,
      freeOnExchange,
      assignedUserId: input.assignedUserId ?? null,
      // Match the post-create assignUserAction pattern: stamp assignedAt
      // whenever an assignee is set at create time. Anchored to createdAt so
      // backdated files report "assigned 3 weeks ago" correctly.
      assignedAt: input.assignedUserId ? (input.createdAt ?? new Date()) : null,
      agentUserId: input.agentUserId ?? null,
      progressedBy: input.progressedBy ?? "progressor",
      serviceType: (input.progressedBy ?? "progressor") === "agent" ? "self_managed" : "outsourced",
      expectedExchangeDate: input.expectedExchangeDate ?? autoExchangeDate,
      purchasePrice: input.purchasePrice ?? null,
      tenure: input.tenure ?? null,
      isShareOfFreehold: input.isShareOfFreehold ?? false,
      isMigrated: input.isMigrated ?? false,
      purchaseType: input.purchaseType ?? null,
      notes: input.notes ?? null,
      vendorSolicitorFirmId: input.vendorSolicitorFirmId ?? null,
      vendorSolicitorContactId: input.vendorSolicitorContactId ?? null,
      purchaserSolicitorFirmId: input.purchaserSolicitorFirmId ?? null,
      purchaserSolicitorContactId: input.purchaserSolicitorContactId ?? null,
      agentFeeAmount: input.agentFeeAmount ?? null,
      agentFeePercent: input.agentFeePercent ?? null,
      agentFeeIsVatInclusive: input.agentFeeIsVatInclusive ?? null,
      referredFirmId: input.referredFirmId ?? null,
      referralFee: input.referralFee ?? null,
      brokerFirmId: input.brokerFirmId ?? null,
      brokerContactId: input.brokerContactId ?? null,
      brokerReferralFee: input.brokerReferralFee ?? null,
      purchaserBrokerReferral: input.purchaserBrokerReferral ?? false,
      twelveWeekTarget,
    },
    });

    // Phase 1 commit 3: stand up Round 1 alongside the new transaction,
    // inside the same $transaction so a failed round-create rolls back
    // the whole file. Snapshot fields mirror the live values exactly as
    // Phase 0's backfill does, so the round and the transaction agree
    // from the first millisecond. Activates this round on the transaction.
    const round = await tx.buyerRound.create({
      data: {
        transactionId: created.id,
        roundNumber: 1,
        status: "active",
        purchasePrice: created.purchasePrice,
        purchaserSolicitorFirmId: created.purchaserSolicitorFirmId,
        purchaserSolicitorContactId: created.purchaserSolicitorContactId,
        brokerFirmId: created.brokerFirmId,
        brokerContactId: created.brokerContactId,
      },
    });
    return tx.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: round.id },
    });
  });

  // Command Centre event log — fires after the $transaction commits.
  await recordEvent({
    type: "transaction_created",
    agencyId: input.agencyId,
    userId: input.agentUserId ?? input.assignedUserId ?? undefined,
    entityType: "PropertyTransaction",
    entityId: newTx.id,
    metadata: {
      progressedBy: newTx.progressedBy,
      serviceType: newTx.serviceType,
      isMigrated: newTx.isMigrated,
    },
  });

  return newTx;
}

// lib/services/transactions.ts — Sprint 6: includes tenure/purchaseType/purchasePrice fields

import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType } from "@prisma/client";
import { scopeTransactionWhere, scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";
import { toUKDateStr } from "@/lib/utils";
import { activeElapsedMs } from "@/lib/services/hold-duration";
import { stampTrialState } from "@/lib/services/trial";
import { assertCanCreateFile } from "@/lib/billing/payment-block";

export async function listTransactions(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null },
  scope?: AccessScope
) {
  const now = new Date();
  const totalMilestones = await prisma.milestoneDefinition.count();
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
  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      contacts: { select: { id: true, name: true, roleType: true } },
      milestoneCompletions: {
        where: { state: "complete" },
        orderBy: { completedAt: "desc" },
        take: 1,
        // milestoneDefinition.name joined for the activity-verb chip
        // ("X confirmed" label per Variant B IA, 2026-05-13).
        select: {
          completedAt: true,
          milestoneDefinition: { select: { name: true } },
        },
      },
      _count: {
        select: {
          milestoneCompletions: { where: { state: "complete" } },
        },
      },
      chaseTasks: {
        where: { status: "pending" },
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
      // `method` is the granular delivery channel (email/sms/whatsapp/phone/
      // voicemail/post per CommMethod enum); `channel` is the higher-level
      // OutboundChannel (email/sms/linkedin/twitter/in_app/other). Both
      // contribute to the verb mapping below; method wins where present.
      communications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, channel: true, method: true, purpose: true, type: true, isAutomated: true },
      },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
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
    // would keep ticking even though no work can happen.
    const daysStuckOnMilestone = lastMilestoneAt && tx.status !== "on_hold"
      ? Math.floor((Date.now() - new Date(lastMilestoneAt).getTime()) / 86400000)
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
    // signal doesn't drift while the file is paused.
    const daysElapsed = activeElapsedMs(new Date(tx.createdAt), {
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

export async function getTransaction(id: string, agencyId: string) {
  return prisma.propertyTransaction.findFirst({
    where: { id, agencyId },
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, portalToken: true, lastVisitedPortalAt: true, createdAt: true } },
      vendorSolicitorFirm: { select: { id: true, name: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      referredFirm: { select: { id: true, name: true } },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
    },
  });
}

export async function getTransactionByScope(id: string, scope: AccessScope) {
  return prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, id),
    include: {
      agency: { select: { id: true, name: true, feeTier: true, legacyOutsourcedFeePence: true } },
      assignedUser: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, portalToken: true, lastVisitedPortalAt: true, createdAt: true } },
      vendorSolicitorFirm: { select: { id: true, name: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      referredFirm: { select: { id: true, name: true } },
      holdPeriods: { select: { startedAt: true, endedAt: true } },
    },
  });
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
  const totalMilestones = await prisma.milestoneDefinition.count();
  const base = scopeTransactionWhere(scope);
  const whereClause: Record<string, unknown> =
    scope.kind === "agency"
      ? { ...base, progressedBy: "progressor", status: { not: "draft" } }
      : { ...base, status: { not: "draft" } };

  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      contacts: { select: { id: true, name: true, roleType: true } },
      milestoneCompletions: {
        where: { state: "complete" },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
      _count: {
        select: {
          milestoneCompletions: { where: { state: "complete" } },
        },
      },
      chaseTasks: {
        where: { status: "pending" },
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
    // signal doesn't drift while the file is paused.
    const daysElapsed = activeElapsedMs(new Date(tx.createdAt), {
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

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...baseWhere,
      status: "active",
      milestoneCompletions: {
        some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { state: "complete", milestoneDefinitionId: { in: completionDefIds } },
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

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...scopeTransactionWhere(scope),
      status: "active",
      progressedBy: "progressor",
      milestoneCompletions: {
        some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } },
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
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { state: "complete", milestoneDefinitionId: { in: completionDefIds } },
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

    return tx.propertyTransaction.create({
    data: {
      propertyAddress: input.propertyAddress,
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
  });

  return newTx;
}

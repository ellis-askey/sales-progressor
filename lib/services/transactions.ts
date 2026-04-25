// lib/services/transactions.ts — Sprint 6: includes tenure/purchaseType/purchasePrice fields

import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType } from "@prisma/client";

export async function listTransactions(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null }
) {
  const now = new Date();
  let whereClause: Record<string, unknown>;
  if (opts?.allAgentFiles) {
    whereClause = opts.firmName
      ? { agencyId, agentUser: { firmName: opts.firmName } }
      : { agencyId, agentUserId: { not: null } };
  } else if (agentUserId) {
    whereClause = { agencyId, agentUserId };
  } else {
    whereClause = { agencyId, progressedBy: "progressor" };
  }
  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true, roleType: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
      _count: {
        select: {
          milestoneCompletions: { where: { isActive: true, isNotRequired: false } },
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
      communications: {
        where: { type: "outbound" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return transactions.map((tx) => {
    const overdueTasks = tx.chaseTasks.filter((t) => new Date(t.dueDate) < now);
    const escalatedTasks = overdueTasks.filter((t) => t.priority === "escalated");
    const nextTask = tx.chaseTasks[0];
    const lastCommAt = tx.communications[0]?.createdAt ?? null;
    const lastMilestoneAt = tx.milestoneCompletions[0]?.completedAt ?? null;
    const lastActivityAt =
      lastCommAt && lastMilestoneAt
        ? new Date(Math.max(lastCommAt.getTime(), lastMilestoneAt.getTime()))
        : lastCommAt ?? lastMilestoneAt;

    const nextActionLabel = nextTask
      ? nextTask.reminderLog.reminderRule.name
      : null;

    const daysStuckOnMilestone = lastMilestoneAt
      ? Math.floor((Date.now() - new Date(lastMilestoneAt).getTime()) / 86400000)
      : null;

    // Confidence score: completed milestones vs 12-week benchmark
    // Mirrors the formula in calculateProgress (fees.ts) using a seeded total of 38 pre-exchange milestones.
    const completedCount = tx._count.milestoneCompletions;
    const daysElapsed = (Date.now() - new Date(tx.createdAt).getTime()) / 86400000;
    const weeksElapsed = daysElapsed / 7;
    const actualPercent = Math.min(100, (completedCount / 38) * 100);
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = actualPercent - expectedPercent;
    const onTrack: "on_track" | "at_risk" | "off_track" | "unknown" =
      completedCount === 0 ? "unknown" :
      diff >= -10 ? "on_track" :
      diff >= -25 ? "at_risk" :
      "off_track";

    const { chaseTasks: _c, communications: _co, _count: _cnt, ...rest } = tx;
    return {
      ...rest,
      health: {
        pendingOverdueTasks: overdueTasks.length,
        escalatedTasks: escalatedTasks.length,
        lastActivityAt,
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
      agency: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, portalToken: true, createdAt: true } },
      vendorSolicitorFirm: { select: { id: true, name: true } },
      vendorSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      purchaserSolicitorFirm: { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, phone: true, email: true } },
      referredFirm: { select: { id: true, name: true } },
    },
  });
}

export async function countTransactionsByStatus(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null }
) {
  let whereClause: Record<string, unknown>;
  if (opts?.allAgentFiles) {
    whereClause = opts.firmName
      ? { agencyId, agentUser: { firmName: opts.firmName } }
      : { agencyId, agentUserId: { not: null } };
  } else if (agentUserId) {
    whereClause = { agencyId, agentUserId };
  } else {
    whereClause = { agencyId, progressedBy: "progressor" };
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

export type ForecastMonth = {
  label: string;        // e.g. "May 2026"
  year: number;
  month: number;        // 0-indexed
  transactions: { id: string; propertyAddress: string; forecastDate: Date }[];
};

export async function getExchangeForecast(agencyId: string, agentUserId?: string, opts?: { allAgentFiles?: boolean; firmName?: string | null }): Promise<ForecastMonth[]> {
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      ...agentFilter,
      OR: [
        { overridePredictedDate: { not: null } },
        { expectedExchangeDate: { not: null } },
      ],
    },
    select: {
      id: true,
      propertyAddress: true,
      overridePredictedDate: true,
      expectedExchangeDate: true,
    },
    orderBy: [{ overridePredictedDate: "asc" }, { expectedExchangeDate: "asc" }],
  });

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() + 4, 1); // up to 3 months ahead

  const mapped = transactions
    .map((tx) => ({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      forecastDate: (tx.overridePredictedDate ?? tx.expectedExchangeDate)!,
    }))
    .filter((tx) => tx.forecastDate >= new Date(now.getFullYear(), now.getMonth(), 1) && tx.forecastDate < cutoff)
    .sort((a, b) => a.forecastDate.getTime() - b.forecastDate.getTime());

  const monthMap = new Map<string, ForecastMonth>();
  for (const tx of mapped) {
    const y = tx.forecastDate.getFullYear();
    const m = tx.forecastDate.getMonth();
    const key = `${y}-${m}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        label: tx.forecastDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        year: y,
        month: m,
        transactions: [],
      });
    }
    monthMap.get(key)!.transactions.push(tx);
  }

  return Array.from(monthMap.values());
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

export async function getExchangedNotCompleting(agencyId: string, agentUserId?: string, opts?: { allAgentFiles?: boolean; firmName?: string | null }): Promise<PostExchangeGroup[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16", "VM13", "PM17"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM12" || d.code === "PM16").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM13" || d.code === "PM17").map((d) => d.id);

  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      ...agentFilter,
      milestoneCompletions: {
        some: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      contacts: { select: { name: true, roleType: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: completionDefIds } },
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  const groups: Record<PostExchangeGroup["urgency"], PostExchangeTransaction[]> = {
    overdue: [],
    this_week: [],
    next_week: [],
    later: [],
    no_date: [],
  };

  for (const tx of exchanged) {
    if (!tx.completionDate) { groups.no_date.push(tx); continue; }
    const d = new Date(tx.completionDate); d.setHours(0, 0, 0, 0);
    if (d < today) groups.overdue.push(tx);
    else if (d < in7) groups.this_week.push(tx);
    else if (d < in14) groups.next_week.push(tx);
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

export async function getCompletingFilesDetailed(agencyId: string): Promise<PostExchangeGroupDetailed[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM12", "PM16", "VM13", "PM17"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM12" || d.code === "PM16").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM13" || d.code === "PM17").map((d) => d.id);

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      progressedBy: "progressor",
      milestoneCompletions: {
        some: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: exchangeDefIds } },
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
        where: { isActive: true, isNotRequired: false, milestoneDefinitionId: { in: completionDefIds } },
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  const groups: Record<PostExchangeGroupDetailed["urgency"], PostExchangeTransactionDetailed[]> = {
    overdue: [], this_week: [], next_week: [], later: [], no_date: [],
  };

  for (const tx of exchanged) {
    if (!tx.completionDate) { groups.no_date.push(tx); continue; }
    const d = new Date(tx.completionDate); d.setHours(0, 0, 0, 0);
    if (d < today) groups.overdue.push(tx);
    else if (d < in7) groups.this_week.push(tx);
    else if (d < in14) groups.next_week.push(tx);
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
  purchasePrice?: number | null;
  tenure?: Tenure | null;
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
};

export async function createTransaction(input: CreateTransactionInput) {
  const twelveWeekTarget = new Date();
  twelveWeekTarget.setDate(twelveWeekTarget.getDate() + 84);

  // Auto-set exchange date to 12 weeks out if not provided
  const autoExchangeDate = new Date();
  autoExchangeDate.setDate(autoExchangeDate.getDate() + 84);

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: input.propertyAddress,
      agencyId: input.agencyId,
      assignedUserId: input.assignedUserId ?? null,
      agentUserId: input.agentUserId ?? null,
      progressedBy: input.progressedBy ?? "progressor",
      serviceType: (input.progressedBy ?? "progressor") === "agent" ? "self_managed" : "outsourced",
      expectedExchangeDate: input.expectedExchangeDate ?? autoExchangeDate,
      purchasePrice: input.purchasePrice ?? null,
      tenure: input.tenure ?? null,
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
      twelveWeekTarget,
    },
  });

  // Fire-and-forget — don't block the create response
  autoSetNotRequired(tx.id, input.tenure, input.purchaseType).catch(console.error);

  return tx;
}

/**
 * Automatically mark milestones as not required based on tenure and purchase type.
 * Freehold → management pack milestones not required
 * Cash / cash from proceeds → mortgage milestones not required
 * Cash from proceeds → deposit also not required
 */
async function autoSetNotRequired(
  transactionId: string,
  tenure: Tenure | null | undefined,
  purchaseType: PurchaseType | null | undefined
) {
  const notRequiredCodes: string[] = [];

  if (tenure === "freehold") {
    notRequiredCodes.push("VM6", "VM7", "PM8");
  }

  if (purchaseType === "cash" || purchaseType === "cash_from_proceeds") {
    notRequiredCodes.push("PM4", "PM5", "PM6");
  }

  if (purchaseType === "cash_from_proceeds") {
    notRequiredCodes.push("PM15b");
  }

  if (notRequiredCodes.length === 0) return;

  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: notRequiredCodes } },
    select: { id: true, code: true },
  });

  for (const def of defs) {
    await prisma.milestoneCompletion.create({
      data: {
        transactionId,
        milestoneDefinitionId: def.id,
        isActive: true,
        isNotRequired: true,
        notRequiredReason: `Auto-set on file creation (${tenure ?? ""}${purchaseType ? ` / ${purchaseType}` : ""})`,
        statusReason: "Auto-set on file creation",
      },
    });
  }

  // Log to activity timeline — only if there's a valid user to attribute it to
  const txRecord = await prisma.propertyTransaction.findUnique({ where: { id: transactionId }, select: { assignedUserId: true } });
  const createdById = txRecord?.assignedUserId ?? null;
  if (notRequiredCodes.length > 0 && createdById) {
    await prisma.communicationRecord.create({
      data: {
        transactionId,
        type: "internal_note",
        contactIds: [],
        content: `File created as ${tenure ?? "unknown tenure"} / ${(purchaseType ?? "unknown purchase type").replace("_", " ")}. The following milestones were automatically set to not required: ${notRequiredCodes.join(", ")}.`,
        createdById,
      },
    });
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { evaluateTransactionReminders, createInitialRemindersInline } from "@/lib/services/reminders";
import { completeMilestone, initializeMilestoneCompletions, maybeUnlockExchangeGate } from "@/lib/services/milestones";
import { logActivity } from "@/lib/services/activity";
import { sendCompletionSurveys } from "@/lib/services/survey";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import type { TransactionStatus, PurchaseType, Tenure, ContactRole, MilestoneSide } from "@prisma/client";

type ContactInput = { name: string; phone?: string; email?: string; roleType: ContactRole };

export async function createTransactionAction(input: {
  propertyAddress: string;
  purchasePrice: number | null;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  notes: string | null;
  progressedBy: "progressor" | "agent";
  contacts: ContactInput[];
  vendorSolicitorFirmId: string | null;
  vendorSolicitorContactId: string | null;
  purchaserSolicitorFirmId: string | null;
  purchaserSolicitorContactId: string | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  agentFeeIsVatInclusive?: boolean | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
  mosUploaded?: boolean;
  mosStoragePath?: string;
  mosFileSize?: number;
  mosMimeType?: string;
  mosFilename?: string;
}) {
  const session = await requireSession();
  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
  const resolvedProgressedBy = isAgent ? input.progressedBy : "progressor";

  const tx = await createTransaction({
    propertyAddress: input.propertyAddress,
    agencyId: session.user.agencyId,
    assignedUserId: isAgent ? undefined : session.user.id,
    agentUserId: isAgent ? session.user.id : null,
    progressedBy: resolvedProgressedBy,
    purchasePrice: input.purchasePrice,
    tenure: input.tenure,
    purchaseType: input.purchaseType,
    notes: input.notes,
    vendorSolicitorFirmId: input.vendorSolicitorFirmId,
    vendorSolicitorContactId: input.vendorSolicitorContactId,
    purchaserSolicitorFirmId: input.purchaserSolicitorFirmId,
    purchaserSolicitorContactId: input.purchaserSolicitorContactId,
    agentFeeAmount: input.agentFeeAmount ?? null,
    agentFeePercent: input.agentFeePercent ?? null,
    agentFeeIsVatInclusive: input.agentFeeIsVatInclusive ?? null,
    referredFirmId: input.referredFirmId ?? null,
    referralFee: input.referralFee ?? null,
  });

  if (input.contacts.length > 0) {
    await prisma.contact.createMany({
      data: input.contacts.map((c) => ({
        propertyTransactionId: tx.id,
        name: c.name.trim(),
        phone: c.phone?.trim() || null,
        email: c.email?.trim() || null,
        roleType: c.roleType,
        portalToken: randomUUID(),
      })),
    });
  }

  // Initialize all milestone completions (available/locked/not_required per tenure+purchaseType)
  if (input.tenure && input.purchaseType) {
    await initializeMilestoneCompletions(tx.id, input.tenure, input.purchaseType, session.user.id);
  }

  // If a MOS document was uploaded during form creation, auto-confirm MOS received for both sides
  let mosAutoConfirmed = false;
  if (input.mosUploaded) {
    const mosDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM2", "PM2"] } },
      select: { id: true },
    });
    await Promise.all(
      mosDefs.map((def) =>
        completeMilestone({
          transactionId: tx.id,
          milestoneDefinitionId: def.id,
          completedById: session.user.id,
          completedByName: session.user.name ?? "",
        })
      )
    );
    mosAutoConfirmed = true;
  }

  // Store MOS document if it was uploaded during form creation
  if (input.mosStoragePath && input.mosFileSize && input.mosMimeType) {
    await prisma.transactionDocument.create({
      data: {
        transactionId: tx.id,
        filename: input.mosFilename ?? "Memorandum of Sale",
        storagePath: input.mosStoragePath,
        fileSize: input.mosFileSize,
        mimeType: input.mosMimeType,
        source: "mos",
      },
    }).catch(console.error);
  }

  // Fast inline creation: batch creates logs + tasks synchronously (~3 queries)
  const completedCodes = mosAutoConfirmed ? ["VM2", "PM2"] : [];
  await createInitialRemindersInline(tx.id, tx.createdAt, tx.assignedUserId, completedCodes).catch(console.error);
  // Full engine handles anchor-based and exchange-gated rules asynchronously
  void evaluateTransactionReminders(tx.id).catch(console.error);

  revalidatePath("/transactions");
  revalidatePath("/agent/transactions");
  revalidatePath("/dashboard");

  return { id: tx.id, mosAutoConfirmed };
}

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

export async function saveCompletionDateAction(transactionId: string, completionDate: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { completionDate: completionDate ? new Date(completionDate) : null },
  });

  const dateStr = completionDate
    ? new Date(completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  await logActivity(
    transactionId,
    dateStr
      ? `${session.user.name} set completion date to ${dateStr}`
      : `${session.user.name} cleared completion date`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function changeStatusAction(
  transactionId: string,
  status: TransactionStatus,
  fallThroughReason?: string | null
) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, status: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.status === status) return;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: {
      status,
      fallThroughReason: status === "withdrawn" ? (fallThroughReason ?? null) : null,
    },
  });

  const reasonNote = status === "withdrawn" && fallThroughReason
    ? ` Reason: ${fallThroughReason}.`
    : "";

  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${session.user.name} changed status from ${STATUS_LABELS[tx.status]} to ${STATUS_LABELS[status]}.${reasonNote}`,
      createdById: session.user.id,
    },
  });

  if (status === "completed") {
    sendCompletionSurveys(transactionId).catch(console.error);
  }

  revalidateTx(transactionId);
}

export async function savePriceAction(transactionId: string, purchasePrice: number) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, purchasePrice: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (tx.purchasePrice !== purchasePrice) {
    await prisma.priceHistory.create({
      data: { transactionId, oldPrice: tx.purchasePrice, newPrice: purchasePrice, changedById: session.user.id },
    });
    const oldFmt = tx.purchasePrice ? `£${(tx.purchasePrice / 100).toLocaleString("en-GB")}` : "not set";
    const newFmt = `£${(purchasePrice / 100).toLocaleString("en-GB")}`;
    await prisma.outboundMessage.create({
      data: {
        transactionId, type: "internal_note", contactIds: [],
        content: `Purchase price updated from ${oldFmt} to ${newFmt}`,
        createdById: session.user.id,
      },
    });
  }

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data: { purchasePrice } });
  revalidateTx(transactionId);
}

export async function saveOverrideDateAction(transactionId: string, overridePredictedDate: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { overridePredictedDate: overridePredictedDate ? new Date(overridePredictedDate) : null },
  });

  const dateStr = overridePredictedDate
    ? new Date(overridePredictedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  await logActivity(
    transactionId,
    dateStr
      ? `${session.user.name} set expected exchange date to ${dateStr}`
      : `${session.user.name} cleared expected exchange date`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function saveAgentFeeAction(input: {
  transactionId: string;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: {
      agentFeeAmount: input.agentFeeAmount,
      agentFeePercent: input.agentFeePercent,
      agentFeeIsVatInclusive: input.agentFeeIsVatInclusive,
    },
  });

  await logActivity(
    input.transactionId,
    `${session.user.name} updated agent fee`,
    session.user.id
  );

  revalidateTx(input.transactionId);
}

export async function assignUserAction(transactionId: string, assignedUserId: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  if (scope.kind !== "all") throw new Error("Forbidden: only admin can assign a progressor");

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { assignedUserId: assignedUserId || null, assignedAt: assignedUserId ? new Date() : null },
  });

  const assignee = assignedUserId
    ? await prisma.user.findFirst({ where: { id: assignedUserId }, select: { name: true } })
    : null;
  await logActivity(
    transactionId,
    assignee
      ? `${session.user.name} assigned file to ${assignee.name}`
      : `${session.user.name} unassigned file`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function saveSolicitorsAction(transactionId: string, patch: {
  vendorSolicitorFirmId?: string | null;
  vendorSolicitorContactId?: string | null;
  purchaserSolicitorFirmId?: string | null;
  purchaserSolicitorContactId?: string | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const { referredFirmId, referralFee, ...solicitorPatch } = patch;
  const data: Record<string, unknown> = { ...solicitorPatch };
  if (referredFirmId !== undefined) {
    data.referredFirmId = referredFirmId;
    data.referralFee = referralFee ?? null;
  }

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data });

  await logActivity(transactionId, `${session.user.name} updated solicitor details`, session.user.id);

  revalidateTx(transactionId);
}

export async function savePurchaseTypeAction(transactionId: string, purchaseType: PurchaseType) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data: { purchaseType } });

  const TYPE_LABELS: Record<string, string> = { cash: "Cash", mortgage: "Mortgage", unknown: "Unknown" };
  await logActivity(
    transactionId,
    `${session.user.name} changed purchase type to ${TYPE_LABELS[purchaseType] ?? purchaseType}`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function saveReferralAction(
  transactionId: string,
  data: { referredFirmId: string | null; referralFee: number | null; referralFeeReceived: boolean }
) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: {
      referredFirmId:      data.referredFirmId,
      referralFee:         data.referralFee,
      referralFeeReceived: data.referralFeeReceived,
    },
  });

  await logActivity(transactionId, `${session.user.name} updated referral details`, session.user.id);

  revalidateTx(transactionId);
}

// ─── Draft actions ────────────────────────────────────────────────────────────

const DRAFT_STATUS = "draft" as TransactionStatus;

export async function saveDraftAction(data: {
  draftId?: string;
  propertyAddress: string;
  tenure?: Tenure | null;
  purchaseType?: PurchaseType | null;
  purchasePrice?: number | null;
  vendorName?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  purchaserEmail?: string;
  progressedBy?: "progressor" | "agent";
}) {
  const session = await requireSession();

  if (data.draftId) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { ...scopeOwnershipWhere(getAccessScope(session), data.draftId), status: DRAFT_STATUS },
      select: { id: true },
    });
    if (!existing) throw new Error("Draft not found");

    await prisma.propertyTransaction.update({
      where: { id: data.draftId },
      data: {
        propertyAddress: data.propertyAddress,
        tenure: data.tenure ?? null,
        purchaseType: data.purchaseType ?? null,
        purchasePrice: data.purchasePrice ?? null,
      },
    });

    await prisma.contact.deleteMany({ where: { propertyTransactionId: data.draftId } });
    const updatedContacts = [
      ...(data.vendorName?.trim() ? [{ propertyTransactionId: data.draftId, name: data.vendorName.trim(), phone: data.vendorPhone?.trim() || null, email: data.vendorEmail?.trim() || null, roleType: "vendor" as ContactRole }] : []),
      ...(data.purchaserName?.trim() ? [{ propertyTransactionId: data.draftId, name: data.purchaserName.trim(), phone: data.purchaserPhone?.trim() || null, email: data.purchaserEmail?.trim() || null, roleType: "purchaser" as ContactRole }] : []),
    ];
    if (updatedContacts.length > 0) await prisma.contact.createMany({ data: updatedContacts });

    revalidatePath("/agent/quick-add");
    revalidatePath("/agent/transactions/new");
    return { id: data.draftId };
  }

  // Create new draft
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: data.propertyAddress,
      tenure: data.tenure ?? null,
      purchaseType: data.purchaseType ?? null,
      purchasePrice: data.purchasePrice ?? null,
      status: DRAFT_STATUS,
      agencyId: session.user.agencyId,
      agentUserId: session.user.id,
      progressedBy: data.progressedBy ?? "progressor",
      serviceType: (data.progressedBy ?? "progressor") === "progressor" ? "outsourced" : "self_managed",
    },
  });

  // Save contacts if provided
  const contactData = [
    ...(data.vendorName?.trim() ? [{ propertyTransactionId: tx.id, name: data.vendorName.trim(), phone: data.vendorPhone?.trim() || null, email: data.vendorEmail?.trim() || null, roleType: "vendor" as ContactRole }] : []),
    ...(data.purchaserName?.trim() ? [{ propertyTransactionId: tx.id, name: data.purchaserName.trim(), phone: data.purchaserPhone?.trim() || null, email: data.purchaserEmail?.trim() || null, roleType: "purchaser" as ContactRole }] : []),
  ];
  if (contactData.length > 0) {
    await prisma.contact.createMany({ data: contactData });
  }

  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/transactions/new");
  return { id: tx.id };
}

export async function promoteDraftAction(
  draftId: string,
  data: {
    propertyAddress: string;
    tenure: Tenure;
    purchaseType: PurchaseType;
    purchasePrice: number | null;
    contacts: { name: string; phone: string | null; email?: string | null; roleType: ContactRole }[];
    progressedBy?: "progressor" | "agent";
  }
) {
  const session = await requireSession();

  const draft = await prisma.propertyTransaction.findFirst({
    where: { id: draftId, agencyId: session.user.agencyId, status: DRAFT_STATUS },
  });
  if (!draft) throw new Error("Draft not found");

  // Delete existing contacts on the draft and recreate
  await prisma.contact.deleteMany({ where: { propertyTransactionId: draftId } });
  if (data.contacts.length > 0) {
    await prisma.contact.createMany({
      data: data.contacts.map((c) => ({
        propertyTransactionId: draftId,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        roleType: c.roleType,
        portalToken: randomUUID(),
      })),
    });
  }

  await prisma.propertyTransaction.update({
    where: { id: draftId },
    data: {
      propertyAddress: data.propertyAddress,
      tenure: data.tenure,
      purchaseType: data.purchaseType,
      purchasePrice: data.purchasePrice,
      status: "active",
      ...(data.progressedBy ? {
        progressedBy: data.progressedBy,
        serviceType: data.progressedBy === "progressor" ? "outsourced" : "self_managed",
      } : {}),
    },
  });

  evaluateTransactionReminders(draftId).catch(() => {});
  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/all-files");
  return { id: draftId };
}

export async function discardDraftAction(draftId: string) {
  const session = await requireSession();
  await prisma.propertyTransaction.deleteMany({
    where: { id: draftId, agencyId: session.user.agencyId, status: DRAFT_STATUS },
  });
  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/transactions/new");
}

// ─── Edit Sale Details reconciliation ────────────────────────────────────────

const CASH_NR_CODES = new Set(["PM5", "PM6", "PM11"]);
const FREEHOLD_NR_CODES = new Set(["VM8", "VM9", "PM12"]);
const EXCHANGE_GATE_CODES_SET = new Set(["VM18", "PM25"]);

function computeAutoNrCodes(purchaseType: PurchaseType | null, tenure: Tenure | null): Set<string> {
  const codes = new Set<string>();
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    CASH_NR_CODES.forEach((c) => codes.add(c));
  }
  if (tenure === "freehold") {
    FREEHOLD_NR_CODES.forEach((c) => codes.add(c));
  }
  return codes;
}

function computeNewMilestoneState(code: string, stateByCode: Map<string, string>): "available" | "locked" {
  if (EXCHANGE_GATE_CODES_SET.has(code)) return "locked";
  const prereqs = DIRECT_PREREQUISITES[code] ?? [];
  if (prereqs.length === 0) return "available";
  const allSatisfied = prereqs.every((p) => {
    const s = stateByCode.get(p);
    return s === "complete" || s === "not_required";
  });
  return allSatisfied ? "available" : "locked";
}

function calcSidePercent(milestones: { weight: number; isComplete: boolean; isNotRequired: boolean }[]): number {
  const applicable = milestones.filter((m) => !m.isNotRequired);
  const denom = applicable.reduce((s, m) => s + m.weight, 0);
  if (denom === 0) return 100;
  const num = applicable.filter((m) => m.isComplete).reduce((s, m) => s + m.weight, 0);
  return (num / denom) * 100;
}

export type SaleDetailsDeltaItem = { id: string; name: string; code: string; side: string; weight: number; wasComplete: boolean };

export type SaleDetailsDelta = {
  noChange: boolean;
  becomingNr: SaleDetailsDeltaItem[];
  becomingRequired: SaleDetailsDeltaItem[];
  currentPercent: number;
  projectedPercent: number;
  currentRemaining: number;
  projectedRemaining: number;
};

export async function getSaleDetailsDelta(input: {
  transactionId: string;
  newPurchaseType: PurchaseType;
  newTenure: Tenure;
}): Promise<SaleDetailsDelta> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, purchaseType: true, tenure: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.newPurchaseType === tx.purchaseType && input.newTenure === tx.tenure) {
    return { noChange: true, becomingNr: [], becomingRequired: [], currentPercent: 0, projectedPercent: 0, currentRemaining: 0, projectedRemaining: 0 };
  }

  const oldNrCodes = computeAutoNrCodes(tx.purchaseType, tx.tenure);
  const newNrCodes = computeAutoNrCodes(input.newPurchaseType, input.newTenure);

  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, name: true, side: true, weight: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  const defByCode = new Map(allDefs.map((d) => [d.code, d]));
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId },
    select: { milestoneDefinitionId: true, state: true },
  });

  const stateByCode = new Map(completions.map((c) => [codeById.get(c.milestoneDefinitionId) ?? "", c.state as string]));

  const becomingNr: SaleDetailsDeltaItem[] = [];
  const becomingRequired: SaleDetailsDeltaItem[] = [];

  for (const code of newNrCodes) {
    if (oldNrCodes.has(code)) continue;
    const def = defByCode.get(code);
    if (!def) continue;
    const state = stateByCode.get(code);
    if (state === "not_required") continue; // already NR — no-op
    becomingNr.push({ id: def.id, name: def.name, code, side: def.side, weight: Number(def.weight), wasComplete: state === "complete" });
  }

  for (const code of oldNrCodes) {
    if (newNrCodes.has(code)) continue;
    const def = defByCode.get(code);
    if (!def) continue;
    if (stateByCode.get(code) === "not_required") {
      becomingRequired.push({ id: def.id, name: def.name, code, side: def.side, weight: Number(def.weight), wasComplete: false });
    }
  }

  // Simulate projected state for percent calculation
  const projectedStates = new Map(stateByCode);
  for (const item of becomingNr) projectedStates.set(item.code, "not_required");
  for (const item of becomingRequired) projectedStates.set(item.code, computeNewMilestoneState(item.code, projectedStates));

  const vendor = allDefs.filter((d) => d.side === "vendor");
  const purchaser = allDefs.filter((d) => d.side === "purchaser");

  const toLite = (defs: typeof allDefs, states: Map<string, string>) =>
    defs.map((d) => {
      const s = states.get(d.code) ?? "locked";
      return { weight: Number(d.weight), isComplete: s === "complete", isNotRequired: s === "not_required" };
    });

  const currentLite = [...toLite(vendor, stateByCode), ...toLite(purchaser, stateByCode)];
  const projectedLite = [...toLite(vendor, projectedStates), ...toLite(purchaser, projectedStates)];

  const currentPercent = Math.round((calcSidePercent(toLite(vendor, stateByCode)) + calcSidePercent(toLite(purchaser, stateByCode))) / 2);
  const projectedPercent = Math.round((calcSidePercent(toLite(vendor, projectedStates)) + calcSidePercent(toLite(purchaser, projectedStates))) / 2);
  const currentRemaining = currentLite.filter((m) => !m.isNotRequired && !m.isComplete).length;
  const projectedRemaining = projectedLite.filter((m) => !m.isNotRequired && !m.isComplete).length;

  return { noChange: false, becomingNr, becomingRequired, currentPercent, projectedPercent, currentRemaining, projectedRemaining };
}

export async function confirmSaleDetailsAction(input: {
  transactionId: string;
  newPurchaseType: PurchaseType;
  newTenure: Tenure;
}): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, purchaseType: true, tenure: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.newPurchaseType === tx.purchaseType && input.newTenure === tx.tenure) return;

  const oldNrCodes = computeAutoNrCodes(tx.purchaseType, tx.tenure);
  const newNrCodes = computeAutoNrCodes(input.newPurchaseType, input.newTenure);

  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, name: true, side: true, blocksExchange: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const defByCode = new Map(allDefs.map((d) => [d.code, d]));
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId },
    select: { milestoneDefinitionId: true, state: true },
  });
  const stateByCode = new Map(completions.map((c) => [codeById.get(c.milestoneDefinitionId) ?? "", c.state as string]));

  // Codes that are newly becoming NR — includes complete milestones (will be reversed)
  const toNrCodes = [...newNrCodes].filter((c) => !oldNrCodes.has(c) && stateByCode.get(c) !== "not_required");

  // Codes that were auto-NR and must return to required
  const toRequiredCodes = [...oldNrCodes].filter((c) => !newNrCodes.has(c) && stateByCode.get(c) === "not_required");

  // Simulate NR writes first so re-activation prereq check sees correct state
  const projectedStates = new Map(stateByCode);
  for (const code of toNrCodes) projectedStates.set(code, "not_required");

  const reactivatedStates = new Map<string, "available" | "locked">();
  for (const code of toRequiredCodes) {
    const newState = computeNewMilestoneState(code, projectedStates);
    reactivatedStates.set(code, newState);
    projectedStates.set(code, newState);
  }

  // Reminder logs for NR'd milestones
  const nrReminderLogs = toNrCodes.length > 0
    ? await prisma.reminderLog.findMany({
        where: {
          transactionId: input.transactionId,
          status: "active",
          reminderRule: { targetMilestoneCode: { in: toNrCodes } },
        },
        select: { id: true },
      })
    : [];

  // Which sides have blocksExchange milestones in the affected set — need gate sync
  const affectedSides = new Set<MilestoneSide>();
  for (const code of [...toNrCodes, ...toRequiredCodes]) {
    const def = defByCode.get(code);
    if (def?.blocksExchange) affectedSides.add(def.side);
  }


  await prisma.$transaction(async (ptx) => {
    // 1. Update sale details
    await ptx.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { purchaseType: input.newPurchaseType, tenure: input.newTenure },
    });

    // 2. NR milestones (includes reversal of complete ones)
    const reversedCodes: string[] = [];
    for (const code of toNrCodes) {
      const def = defByCode.get(code);
      if (!def) continue;
      const nrReason = FREEHOLD_NR_CODES.has(code) ? "Freehold property"
        : input.newPurchaseType === "cash_buyer" ? "Cash buyer" : "Cash from proceeds";
      const wasComplete = stateByCode.get(code) === "complete";
      await ptx.milestoneCompletion.update({
        where: { transactionId_milestoneDefinitionId: { transactionId: input.transactionId, milestoneDefinitionId: def.id } },
        data: {
          state: "not_required",
          notRequiredReason: nrReason,
          completedAt: null,
          completedById: session.user.id,
          summaryText: wasComplete ? null : undefined,
        },
      });
      if (wasComplete) reversedCodes.push(code);
    }

    // 3a. Comms records for reversed milestones
    const TYPE_LABEL_COMMS: Record<string, string> = { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" };
    const TENURE_LABEL_COMMS: Record<string, string> = { leasehold: "Leasehold", freehold: "Freehold" };
    for (const code of reversedCodes) {
      const def = defByCode.get(code);
      if (!def) continue;
      const changeDesc = CASH_NR_CODES.has(code)
        ? `purchase type changed from ${TYPE_LABEL_COMMS[tx.purchaseType ?? ""] ?? tx.purchaseType} to ${TYPE_LABEL_COMMS[input.newPurchaseType]}`
        : `tenure changed from ${TENURE_LABEL_COMMS[tx.tenure ?? ""] ?? tx.tenure} to ${TENURE_LABEL_COMMS[input.newTenure]}`;
      await ptx.outboundMessage.create({
        data: {
          transactionId: input.transactionId,
          type: "internal_note",
          contactIds: [],
          content: `Milestone reversed: "${def.name}" no longer applies — ${changeDesc}.`,
          createdById: session.user.id,
        },
      });
    }

    // ATOMICITY_TEST: throw new Error("Atomicity test — roll back");

    // 4. Re-activate milestones
    for (const [code, newState] of reactivatedStates) {
      const def = defByCode.get(code);
      if (!def) continue;
      await ptx.milestoneCompletion.update({
        where: { transactionId_milestoneDefinitionId: { transactionId: input.transactionId, milestoneDefinitionId: def!.id } },
        data: { state: newState, notRequiredReason: null, completedAt: null, completedById: null },
      });
    }

    // 5. Deactivate reminder logs for NR'd milestones
    if (nrReminderLogs.length > 0) {
      const logIds = nrReminderLogs.map((l) => l.id);
      await ptx.chaseTask.updateMany({
        where: { reminderLogId: { in: logIds }, status: "pending" },
        data: { status: "inactive" },
      });
      await ptx.reminderLog.updateMany({
        where: { id: { in: logIds } },
        data: { status: "inactive", statusReason: "Marked not required — sale details changed" },
      });
    }

    // 6. Gate sync for each affected side
    for (const side of affectedSides) {
      const gateCode = side === "vendor" ? "VM18" : "PM25";
      const gateDef = defByCode.get(gateCode);
      if (!gateDef) continue;
      const gateDefId = gateDef!.id;

      const gateComp = await ptx.milestoneCompletion.findFirst({
        where: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId },
        select: { state: true },
      });
      if (!gateComp) continue;
      const gateState = gateComp!.state;
      if (gateState === "complete" || gateState === "not_required") continue;

      const blockers = allDefs.filter((d) => d.side === side && d.blocksExchange && d.code !== gateCode);
      const blockerComps = await ptx.milestoneCompletion.findMany({
        where: { transactionId: input.transactionId, milestoneDefinitionId: { in: blockers.map((b) => b.id) } },
        select: { milestoneDefinitionId: true, state: true },
      });
      const blockerMap = new Map(blockerComps.map((c) => [c.milestoneDefinitionId, c.state]));

      const allClear = blockers.every((b) => {
        const s = blockerMap.get(b.id);
        return s === "complete" || s === "not_required";
      });

      if (allClear && gateState === "locked") {
        await ptx.milestoneCompletion.update({
          where: { transactionId_milestoneDefinitionId: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId } },
          data: { state: "available" },
        });
      } else if (!allClear && gateState === "available") {
        await ptx.milestoneCompletion.update({
          where: { transactionId_milestoneDefinitionId: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId } },
          data: { state: "locked" },
        });
      }
    }
  });

  const TYPE_LABEL: Record<string, string> = { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" };
  const TENURE_LABEL: Record<string, string> = { leasehold: "Leasehold", freehold: "Freehold" };
  const changes: string[] = [];
  if (input.newPurchaseType !== tx.purchaseType) {
    changes.push(`purchase type from ${TYPE_LABEL[tx.purchaseType ?? ""] ?? tx.purchaseType} to ${TYPE_LABEL[input.newPurchaseType]}`);
  }
  if (input.newTenure !== tx.tenure) {
    changes.push(`tenure from ${TENURE_LABEL[tx.tenure ?? ""] ?? tx.tenure} to ${TENURE_LABEL[input.newTenure]}`);
  }
  await logActivity(input.transactionId, `${session.user.name} updated ${changes.join(" and ")}`, session.user.id);

  revalidateTx(input.transactionId);
}

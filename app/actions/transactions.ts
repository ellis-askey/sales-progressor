"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { evaluateTransactionReminders } from "@/lib/services/reminders";
import { completeMilestone } from "@/lib/services/milestones";
import { logActivity } from "@/lib/services/activity";
import { sendCompletionSurveys } from "@/lib/services/survey";
import type { TransactionStatus, PurchaseType, Tenure, ContactRole } from "@prisma/client";

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
}) {
  const session = await requireSession();
  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
  const resolvedProgressedBy = isAgent ? input.progressedBy : "progressor";

  const tx = await createTransaction({
    propertyAddress: input.propertyAddress,
    agencyId: session.user.agencyId,
    assignedUserId: isAgent && resolvedProgressedBy === "agent" ? session.user.id : (isAgent ? undefined : session.user.id),
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

  // Await reminder evaluation so reminders are present when the user lands on the file
  await evaluateTransactionReminders(tx.id).catch(console.error);

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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
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

  await prisma.communicationRecord.create({
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true, purchasePrice: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (tx.purchasePrice !== purchasePrice) {
    await prisma.priceHistory.create({
      data: { transactionId, oldPrice: tx.purchasePrice, newPrice: purchasePrice, changedById: session.user.id },
    });
    const oldFmt = tx.purchasePrice ? `£${(tx.purchasePrice / 100).toLocaleString("en-GB")}` : "not set";
    const newFmt = `£${(purchasePrice / 100).toLocaleString("en-GB")}`;
    await prisma.communicationRecord.create({
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: session.user.agencyId },
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { assignedUserId: assignedUserId || null },
  });

  const assignee = assignedUserId
    ? await prisma.user.findFirst({ where: { id: assignedUserId, agencyId: session.user.agencyId }, select: { name: true } })
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
}) {
  const session = await requireSession();
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data: patch });

  await logActivity(transactionId, `${session.user.name} updated solicitor details`, session.user.id);

  revalidateTx(transactionId);
}

export async function savePurchaseTypeAction(transactionId: string, purchaseType: PurchaseType) {
  const session = await requireSession();
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
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
    // Update existing draft
    await prisma.propertyTransaction.update({
      where: { id: data.draftId, agencyId: session.user.agencyId },
      data: {
        propertyAddress: data.propertyAddress,
        tenure: data.tenure ?? null,
        purchaseType: data.purchaseType ?? null,
        purchasePrice: data.purchasePrice ?? null,
      },
    });
    revalidatePath("/agent/quick-add");
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
}

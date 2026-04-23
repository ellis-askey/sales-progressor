"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { TransactionStatus, PurchaseType } from "@prisma/client";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
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
  revalidateTx(transactionId);
}

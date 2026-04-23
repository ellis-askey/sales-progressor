"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { PurchaseType } from "@prisma/client";
import {
  completeMilestone,
  bulkCompleteMilestones,
  markNotRequiredWithCascade,
  reverseMilestoneWithCascade,
} from "@/lib/services/milestones";

/**
 * Confirm a milestone (and any implied predecessors) for a transaction.
 * Equivalent to POST /api/milestones { action: "complete" } but runs as a
 * Server Action so Next.js automatically invalidates the Router Cache and
 * re-renders the page without a client-side router.refresh().
 *
 * The Route Handler at /api/milestones is kept alive for non-React callers.
 * Both paths call the same service functions — no business logic here.
 */
export async function confirmMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  impliedIds?: string[];
  eventDate?: string | null;
}) {
  const session = await requireSession();

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.impliedIds && input.impliedIds.length > 0) {
    await bulkCompleteMilestones(
      input.impliedIds,
      input.transactionId,
      session.user.id,
      session.user.name ?? ""
    );
  }

  const result = await completeMilestone({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    eventDate: input.eventDate ? new Date(input.eventDate) : null,
  });

  revalidatePath(`/transactions/${input.transactionId}`, "page");

  return result;
}

export async function markNotRequiredAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason: string;
  purchaseType?: PurchaseType;
}) {
  const session = await requireSession();

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const result = await markNotRequiredWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    purchaseType: input.purchaseType,
  });

  revalidatePath(`/transactions/${input.transactionId}`, "page");

  return result;
}

export async function reverseMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason?: string;
  downstreamIds?: string[];
  newPurchaseType?: PurchaseType;
}) {
  const session = await requireSession();

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await reverseMilestoneWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    downstreamIds: input.downstreamIds,
    newPurchaseType: input.newPurchaseType,
  });

  revalidatePath(`/transactions/${input.transactionId}`, "page");
}

"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { PurchaseType } from "@prisma/client";
import {
  completeMilestone,
  bulkCompleteMilestones,
  markNotRequiredWithCascade,
  reverseMilestoneWithCascade,
} from "@/lib/services/milestones";
import { pushToTransaction } from "@/lib/services/push";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { sendAdminMilestoneNotificationToPortal } from "@/lib/services/portal";

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
    select: { id: true, propertyAddress: true },
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

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });

  const result = await completeMilestone({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    eventDate: input.eventDate ? new Date(input.eventDate) : null,
  });

  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");

  // Push to subscribed portal contacts (fire-and-forget)
  if (def) {
    const code  = def.code;
    const label = getMilestoneCopy(code).label;
    const short = tx.propertyAddress.split(",")[0];

    let title = "Progress update";
    let body  = `${short} — "${label}" is complete.`;

    if (code === "VM12" || code === "PM16") {
      title = "Contracts exchanged!";
      body  = `${short} — your transaction is now legally committed.`;
    } else if (code === "VM13" || code === "PM17") {
      title = "Completed!";
      body  = `${short} — congratulations, your transaction has completed.`;
    } else if (code === "VM20" || code === "PM27") {
      title = "Ready to exchange";
      body  = `${short} — your solicitor has confirmed everything is in place.`;
    } else if (input.eventDate) {
      const fmtDate = new Date(input.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      title = `Date confirmed — ${short}`;
      body  = `${label}: ${fmtDate}`;
    }

    pushToTransaction(input.transactionId, {
      title,
      body,
      urlPath: "/progress",
    }).catch(() => {});

    // Email all vendor/purchaser portal contacts with a translated progress update
    sendAdminMilestoneNotificationToPortal(
      input.transactionId,
      code,
      input.eventDate ?? null
    ).catch(() => {});
  }

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

  revalidateTx(input.transactionId);

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

  revalidateTx(input.transactionId);
}

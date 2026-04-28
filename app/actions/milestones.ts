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

  // Bilateral pairs: auto-confirm the counterpart milestone on the other side.
  // All counterpart writes happen before revalidate so there is a single rerender.
  const BILATERAL_PAIRS: Record<string, string> = {
    VM18: "PM25", PM25: "VM18",
    VM19: "PM26", PM26: "VM19",
    VM20: "PM27", PM27: "VM20",
  };
  const counterCode = def?.code ? BILATERAL_PAIRS[def.code] : undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    if (counterDef) {
      const alreadyDone = await prisma.milestoneCompletion.findFirst({
        where: { transactionId: input.transactionId, milestoneDefinitionId: counterDef.id, state: "complete" },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDef.id,
          completedById: session.user.id,
          completedByName: session.user.name ?? "",
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        });
      }
    }
  }

  // Single revalidate after all DB writes (primary + bilateral counterpart)
  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");

  // Completion: sync the transaction completionDate if the confirmed date differs
  if ((def?.code === "VM20" || def?.code === "PM27") && input.eventDate) {
    const actualDate = new Date(input.eventDate);
    const txData = await prisma.propertyTransaction.findFirst({
      where: { id: input.transactionId },
      select: { completionDate: true },
    });
    const existingDate = txData?.completionDate;
    const dateMismatch = !existingDate ||
      Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000; // >12h apart
    if (dateMismatch) {
      await prisma.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { completionDate: actualDate },
      });
      revalidateTx(input.transactionId);
    }
  }

  // Push to subscribed portal contacts (fire-and-forget)
  if (def) {
    const code  = def.code;
    const label = getMilestoneCopy(code).label;
    const short = tx.propertyAddress.split(",")[0];

    let title = "Progress update";
    let body  = `${short} — "${label}" is complete.`;

    if (code === "VM19" || code === "PM26") {
      title = "Contracts exchanged!";
      body  = `${short} — your transaction is now legally committed.`;
    } else if (code === "VM20" || code === "PM27") {
      title = "Completed!";
      body  = `${short} — congratulations, your transaction has completed.`;
    } else if (code === "VM18" || code === "PM25") {
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

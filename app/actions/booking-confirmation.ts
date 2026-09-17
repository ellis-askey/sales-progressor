"use server";

// Server action for confirming a provisional buyer-logged survey / lender
// valuation booking (PM6 / PM9) from the hub "Surveys & valuations to confirm"
// pile. Confirming releases the held client emails via releaseProvisionalBooking.
// See docs/active/booking-reminders/00-plan.md.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { releaseProvisionalBooking } from "@/lib/services/portal";
import { markNotRequiredWithCascade } from "@/lib/services/milestones";

// How the confirmer resolved a provisional buyer-logged booking:
//  - confirm:      real booking → notify buyer + seller with the date.
//  - desktop:      lender desktop valuation, no visit → correct copy, no seller access line (PM6).
//  - silent:       log it, send no client emails.
//  - not_required: not a genuine booking → mark the step (and its cascade, e.g.
//                  survey→survey-report) not required, one internal note, no emails (PM9).
export type BookingOutcome = "confirm" | "desktop" | "silent" | "not_required";

export async function confirmProvisionalBookingAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  keyCollectionRequired: boolean;
  // Optional corrected appointment date (YYYY-MM-DD). Omit to keep the date
  // the buyer entered.
  eventDate?: string | null;
  outcome?: BookingOutcome;
}): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Ownership guard (Law 7): the acting user must have access to this file.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const outcome = input.outcome ?? "confirm";

  // "Not a real booking" → not required (+ silent cascade to any downstream step,
  // e.g. survey report). One clean activity note, no client emails. Then clear
  // the lingering provisional flag so the row leaves the tray tidily.
  if (outcome === "not_required") {
    await markNotRequiredWithCascade({
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      completedById: session.user.id,
      completedByName: session.user.name ?? "",
      reason: "Logged in error, not a genuine booking",
    });
    await prisma.milestoneCompletion.updateMany({
      where: {
        transactionId: input.transactionId,
        milestoneDefinitionId: input.milestoneDefinitionId,
        awaitingBookingConfirmation: true,
      },
      data: { awaitingBookingConfirmation: false },
    });
    revalidatePath("/agent/hub");
    revalidatePath(`/agent/transactions/${input.transactionId}`);
    return { ok: true };
  }

  const result = await releaseProvisionalBooking({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    keyCollectionRequired: input.keyCollectionRequired,
    eventDate: input.eventDate ?? null,
    outcome,
    actingUserId: session.user.id,
    actingUserName: session.user.name ?? "",
  });

  revalidatePath("/agent/hub");
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return result;
}

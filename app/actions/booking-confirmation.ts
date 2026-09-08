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

export async function confirmProvisionalBookingAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  keyCollectionRequired: boolean;
  // Optional corrected appointment date (YYYY-MM-DD). Omit to keep the date
  // the buyer entered.
  eventDate?: string | null;
}): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Ownership guard (Law 7): the acting user must have access to this file.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const result = await releaseProvisionalBooking({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    keyCollectionRequired: input.keyCollectionRequired,
    eventDate: input.eventDate ?? null,
  });

  revalidatePath("/agent/hub");
  return result;
}

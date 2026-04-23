"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { portalCompleteMilestone, portalMarkNotRequired } from "@/lib/services/portal";
import { sendClientPortalMessage, sendProgressorPortalReply } from "@/lib/services/portal-messages";
import { prisma } from "@/lib/prisma";

export async function portalConfirmMilestoneAction(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const completion = await portalCompleteMilestone(input);

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");

  return completion;
}

export async function portalMarkNotRequiredAction(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  await portalMarkNotRequired(input);

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");
}

export async function portalSendMessageAction(input: {
  token: string;
  content: string;
}) {
  if (!input.content.trim()) throw new Error("Message cannot be empty");
  await sendClientPortalMessage(input.token, input.content.trim());
  revalidatePath(`/portal/${input.token}/updates`, "page");
}

export async function replyPortalMessageAction(input: {
  transactionId: string;
  contactId: string;
  content: string;
}) {
  const session = await requireSession();
  if (!input.content.trim()) throw new Error("Reply cannot be empty");

  // Verify the transaction belongs to this agency
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await sendProgressorPortalReply(
    input.transactionId,
    input.contactId,
    input.content.trim(),
    session.user.id,
    session.user.name ?? "Your team"
  );

  revalidatePath(`/transactions/${input.transactionId}`, "page");
}

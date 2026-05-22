"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { portalCompleteMilestone, portalMarkNotRequired, PORTAL_AGENT_ONLY_ERROR } from "@/lib/services/portal";
import { sendClientPortalMessage, sendProgressorPortalReply } from "@/lib/services/portal-messages";
import { prisma } from "@/lib/prisma";

// Discriminated result so the portal UI can render the B1 hard-block
// gracefully instead of treating it as a server error.
export type PortalConfirmResult =
  | { ok: true }
  | { ok: false; reason: "agent_only" };

export async function portalConfirmMilestoneAction(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}): Promise<PortalConfirmResult> {
  try {
    await portalCompleteMilestone(input);
  } catch (err) {
    // B1 hard-block: surface the agent-only refusal as a structured result
    // so the bottom-sheet renders the explanatory copy instead of a generic
    // 500. Any other error rethrows (the UI still falls back to its generic
    // error path for genuine failures — invalid token, prereq guard, etc.).
    if (err instanceof Error && err.message === PORTAL_AGENT_ONLY_ERROR) {
      return { ok: false, reason: "agent_only" };
    }
    throw err;
  }

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");

  return { ok: true };
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
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
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

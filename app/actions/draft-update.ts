"use server";

// "Draft for everyone" send/save actions. The AI endpoint only returns drafts;
// these commit the two the progressor chose to act on:
//   - the internal note → internal-only record on the file
//   - the client update → posted to the client's portal (+ email if toggled)
// Nothing here is reachable without the progressor clicking Send.

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { sendProgressorPortalReply } from "@/lib/services/portal-messages";
import { logCommAction } from "@/app/actions/comms";

export async function saveDraftNoteAction(input: {
  transactionId: string;
  content: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = input.content.trim();
  if (!text) return { ok: false, error: "Empty note." };
  // logCommAction does its own session + scope check and revalidation.
  await logCommAction({
    transactionId: input.transactionId,
    type: "internal_note",
    method: null,
    contactIds: [],
    content: text,
    visibleToClient: false,
  });
  return { ok: true };
}

export async function sendDraftClientUpdateAction(input: {
  transactionId: string;
  contactIds: string[];
  content: string;
  alsoEmail: boolean;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const text = input.content.trim();
  if (!text) return { ok: false, error: "Empty message." };
  if (input.contactIds.length === 0) return { ok: false, error: "Pick at least one client to send to." };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { id: true, agencyId: true, assignedUserId: true, agentUserId: true },
  });
  if (!tx) return { ok: false, error: "File not found." };
  if (!canReadTransaction(scope, tx)) return { ok: false, error: "Forbidden" };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const progressorName = me?.name ?? "Your progressor";

  // Only real client contacts on this file (guard against tampered ids).
  const contacts = await prisma.contact.findMany({
    where: { id: { in: input.contactIds }, propertyTransactionId: input.transactionId, roleType: { in: ["purchaser", "vendor"] } },
    select: { id: true },
  });

  let count = 0;
  for (const c of contacts) {
    try {
      await sendProgressorPortalReply(input.transactionId, c.id, text, session.user.id, progressorName, { email: input.alsoEmail });
      count++;
    } catch {
      // Skip a single failed recipient; the rest still go.
    }
  }
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true, count };
}

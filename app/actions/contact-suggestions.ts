"use server";

// Phase F2 — accept / dismiss a "add this signature number to the contact"
// suggestion. Suggest-only: nothing runs until an agent taps Add or Dismiss. The
// suggestion is re-read from the stored message (never trusted from the client),
// and the write only lands if the contact still has no phone and the number
// isn't already held by someone else on the file.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { revalidatePath } from "next/cache";

type StoredSuggestion = { contactId: string; contactName: string; phone: string };

async function loadSuggestion(transactionId: string, messageId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  const row = await prisma.outboundMessage.findFirst({
    where: { id: messageId, transactionId },
    select: { id: true, providerWebhookData: true },
  });
  if (!row) return null;
  const data = (row.providerWebhookData as Record<string, unknown> | null) ?? {};
  const suggestion = (data.contactSuggestion as StoredSuggestion | undefined) ?? undefined;
  const resolved = Boolean(data.contactSuggestionResolved);
  return { data, suggestion, resolved };
}

async function markResolved(messageId: string, data: Record<string, unknown>) {
  await prisma.outboundMessage.update({
    where: { id: messageId },
    data: { providerWebhookData: { ...data, contactSuggestionResolved: true } },
  });
}

export async function dismissContactPhoneSuggestionAction(input: {
  transactionId: string;
  messageId: string;
}): Promise<{ ok: boolean }> {
  const loaded = await loadSuggestion(input.transactionId, input.messageId);
  if (!loaded?.suggestion) return { ok: false };
  await markResolved(input.messageId, loaded.data);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function applyContactPhoneSuggestionAction(input: {
  transactionId: string;
  messageId: string;
}): Promise<{ ok: boolean }> {
  const loaded = await loadSuggestion(input.transactionId, input.messageId);
  if (!loaded?.suggestion || loaded.resolved) return { ok: false };
  const { contactId, phone } = loaded.suggestion;

  // Re-verify at write time: contact still on this file, still no phone, and the
  // number isn't already on another contact here (dedupe safety).
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, propertyTransactionId: input.transactionId },
    select: { id: true, phone: true },
  });
  if (!contact) return { ok: false };
  if (contact.phone && contact.phone.trim()) {
    // Someone already filled it — nothing to do, just clear the suggestion.
    await markResolved(input.messageId, loaded.data);
    revalidatePath(`/agent/transactions/${input.transactionId}`);
    return { ok: false };
  }
  const clash = await prisma.contact.findFirst({
    where: { propertyTransactionId: input.transactionId, phone, NOT: { id: contactId } },
    select: { id: true },
  });
  if (clash) {
    await markResolved(input.messageId, loaded.data);
    return { ok: false };
  }

  await prisma.contact.update({ where: { id: contactId }, data: { phone } });
  await markResolved(input.messageId, loaded.data);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

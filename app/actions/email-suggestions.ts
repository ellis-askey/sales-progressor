"use server";

// Phase D3 — accept / dismiss an AI email-read suggestion. Suggest-only: nothing
// here runs until an agent taps Confirm or Dismiss. The suggestion is re-read
// from the stored message by index (never trusted from the client), then routed
// to the existing confirm/create actions, which enforce their own access scope.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { revalidatePath } from "next/cache";
import { confirmMilestoneAction } from "@/app/actions/milestones";
import { confirmOnwardStepAction, confirmRelatedSaleStepAction } from "@/app/actions/onward";
import { createManualTaskAction } from "@/app/actions/manual-tasks";
import type { EmailSuggestion } from "@/lib/services/email-read";

type StoredRead = { summary?: string; suggestions?: EmailSuggestion[]; dismissed?: number[] };

// Load the message (scoped to a transaction the caller can access) and its
// stored read. Returns null if not found / out of scope.
async function loadRead(transactionId: string, messageId: string) {
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
  const read = (data.read as StoredRead | undefined) ?? undefined;
  return { data, read };
}

async function persistDismissed(messageId: string, data: Record<string, unknown>, read: StoredRead, index: number) {
  const dismissed = Array.isArray(read.dismissed) ? [...read.dismissed] : [];
  if (!dismissed.includes(index)) dismissed.push(index);
  await prisma.outboundMessage.update({
    where: { id: messageId },
    data: { providerWebhookData: { ...data, read: { ...read, dismissed } } },
  });
}

export async function dismissEmailSuggestionAction(input: {
  transactionId: string;
  messageId: string;
  index: number;
}): Promise<{ ok: boolean }> {
  const loaded = await loadRead(input.transactionId, input.messageId);
  if (!loaded?.read) return { ok: false };
  await persistDismissed(input.messageId, loaded.data, loaded.read, input.index);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function applyEmailSuggestionAction(input: {
  transactionId: string;
  messageId: string;
  index: number;
}): Promise<{ ok: boolean }> {
  const loaded = await loadRead(input.transactionId, input.messageId);
  if (!loaded?.read) return { ok: false };
  const suggestion = loaded.read.suggestions?.[input.index];
  if (!suggestion) return { ok: false };

  const { transactionId } = input;
  if (suggestion.kind === "milestone") {
    const def = await prisma.milestoneDefinition.findFirst({
      where: { code: suggestion.code },
      select: { id: true },
    });
    if (!def) return { ok: false };
    await confirmMilestoneAction({ transactionId, milestoneDefinitionId: def.id });
  } else if (suggestion.kind === "onward_step") {
    await confirmOnwardStepAction({ transactionId, milestoneCode: suggestion.stepId });
  } else if (suggestion.kind === "related_step") {
    await confirmRelatedSaleStepAction({ transactionId, milestoneCode: suggestion.stepId });
  } else if (suggestion.kind === "todo") {
    await createManualTaskAction({ title: suggestion.title, transactionId, notes: "Suggested from an inbound email" });
  }

  // Accepting also dismisses it, so it doesn't linger once actioned.
  await persistDismissed(input.messageId, loaded.data, loaded.read, input.index).catch(() => {});
  revalidatePath(`/agent/transactions/${transactionId}`);
  return { ok: true };
}

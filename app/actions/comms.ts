"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import {
  createCommunicationRecord,
  deleteCommunicationRecord,
  importWhatsAppChat,
  undoWhatsAppImport,
  type SenderMapping,
  type ImportMessageInput,
  type ImportResult,
} from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import { getAccessScope } from "@/lib/security/access-scope";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export async function addNoteAction(transactionId: string, content: string) {
  const session = await requireSession();
  await createCommunicationRecord({
    transactionId,
    type: "internal_note",
    contactIds: [],
    content,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope: getAccessScope(session),
  });
  void trackServerEvent(session.user.id, ANALYTICS_EVENTS.NOTE_ADDED, {
    transactionId,
    agencyId: session.user.agencyId || undefined,
  });
  revalidateTx(transactionId);
}

export async function deleteCommAction(id: string, transactionId: string) {
  const session = await requireSession();
  await deleteCommunicationRecord(id, getAccessScope(session));
  revalidateTx(transactionId);
}

export async function logCommAction(input: {
  transactionId: string;
  type: CommType;
  method: CommMethod | null;
  contactIds: string[];
  content: string;
  visibleToClient: boolean;
}) {
  const session = await requireSession();
  await createCommunicationRecord({
    transactionId: input.transactionId,
    type: input.type,
    method: input.method,
    contactIds: input.contactIds,
    content: input.content,
    visibleToClient: input.visibleToClient,
    createdById: session.user.id,
    createdByRole: session.user.role,
    scope: getAccessScope(session),
  });
  revalidateTx(input.transactionId);
}

// Bulk WhatsApp chat import is internal-staff-only for now (admin / sales_progressor).
// UI hides the entry point too; this is defence-in-depth.
const PASTE_CHAT_ALLOWED_ROLES = new Set(["admin", "sales_progressor", "superadmin"]);

export async function importWhatsAppChatAction(input: {
  transactionId: string;
  messages: ImportMessageInput[];
  mapping: SenderMapping;
}): Promise<ImportResult> {
  const session = await requireSession();
  if (!PASTE_CHAT_ALLOWED_ROLES.has(session.user.role)) {
    throw new Error("Not available for this role");
  }
  try {
    const result = await importWhatsAppChat(
      input.transactionId,
      input.messages,
      input.mapping,
      session.user.id,
      session.user.role,
      getAccessScope(session),
    );
    revalidateTx(input.transactionId);
    return result;
  } catch (err) {
    // Surface the failure to Vercel logs so the Next.js production
    // "Server Components render" digest can be matched to an actual
    // error message. The PasteWhatsAppPanel still catches and toasts.
    console.error("[importWhatsAppChatAction] failed", {
      transactionId: input.transactionId,
      messageCount: input.messages.length,
      userId: session.user.id,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    throw err;
  }
}

export async function undoWhatsAppImportAction(
  importBatchId: string,
  transactionId: string,
): Promise<{ deleted: number }> {
  const session = await requireSession();
  if (!PASTE_CHAT_ALLOWED_ROLES.has(session.user.role)) {
    throw new Error("Not available for this role");
  }
  const result = await undoWhatsAppImport(importBatchId, getAccessScope(session));
  revalidateTx(transactionId);
  return result;
}

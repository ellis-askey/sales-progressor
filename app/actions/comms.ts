"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { createCommunicationRecord, deleteCommunicationRecord } from "@/lib/services/comms";
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

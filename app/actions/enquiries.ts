"use server";

// Server actions for the internal enquiries tracker panel (Stage 1.6).
// Every action verifies the transaction is in the caller's access scope
// (Law 7) before mutating.

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import {
  logEnquiryMovement,
  setEnquiryOutstandingNote,
  setEnquirySnooze,
  type EnquiryCourt,
} from "@/lib/enquiries/tracker";

async function assertInScope(transactionId: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorised");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Not found");
  return session.user.id;
}

export async function logEnquiryMovementAction(input: {
  transactionId: string;
  note: string;
  flipsCourtTo?: EnquiryCourt | null;
}): Promise<{ ok: boolean }> {
  const userId = await assertInScope(input.transactionId);
  if (!input.note.trim()) return { ok: false };
  const ok = await logEnquiryMovement({
    transactionId: input.transactionId,
    note: input.note,
    flipsCourtTo: input.flipsCourtTo ?? null,
    createdByUserId: userId,
  });
  revalidatePath(`/transactions/${input.transactionId}`);
  return { ok };
}

export async function setEnquiryOutstandingAction(input: {
  transactionId: string;
  note: string | null;
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  await setEnquiryOutstandingNote(input.transactionId, input.note);
  revalidatePath(`/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function setEnquirySnoozeAction(input: {
  transactionId: string;
  workingDays: number | null;
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  await setEnquirySnooze(input.transactionId, input.workingDays);
  revalidatePath(`/transactions/${input.transactionId}`);
  return { ok: true };
}

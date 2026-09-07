"use server";

// Server actions for the internal enquiries tracker panel (Stage 1.6).
// Every action verifies the transaction is in the caller's access scope
// (Law 7) before mutating.

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { getEnquiryHistory, type EnquiryHistoryEntry } from "@/lib/services/enquiries";
import {
  logEnquiryMovement,
  setEnquiryOutstandingNote,
  setEnquirySnooze,
  setEnquirySnoozeUntil,
  type EnquiryCourt,
  type EnquiryMovementMode,
  type EnquiryMovementKind,
} from "@/lib/enquiries/tracker";

const courtLabel = (c: EnquiryCourt) =>
  c === "seller_solicitor" ? "the seller's solicitor" : "the buyer's solicitor";

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
  note?: string;
  // "handover" (default) flips + resets the clock; "touch" resets without
  // flipping; "relabel" flips without touching the clock. See logEnquiryMovement.
  mode?: EnquiryMovementMode;
  flipsCourtTo?: EnquiryCourt | null;
  // Event type for the triage page's pills + history. Defaults to "update".
  kind?: EnquiryMovementKind;
}): Promise<{ ok: boolean }> {
  const userId = await assertInScope(input.transactionId);
  const mode = input.mode ?? "handover";
  const flip = input.flipsCourtTo ?? null;
  // The note is optional (the hero slider is one tap). Synthesise a clear
  // history line when none is given, so the movement log always reads sensibly.
  const note =
    (input.note ?? "").trim() ||
    (mode === "touch"
      ? "They've been in touch, still with them"
      : mode === "relabel"
        ? `Corrected: now with ${flip ? courtLabel(flip) : "the other side"}`
        : `Now with ${flip ? courtLabel(flip) : "the other side"}`);
  const ok = await logEnquiryMovement({
    transactionId: input.transactionId,
    note,
    // "touch" never moves it to the other side, whatever the caller sends.
    flipsCourtTo: mode === "touch" ? null : flip,
    mode,
    kind: input.kind,
    createdByUserId: userId,
  });
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok };
}

// Log a manual chase (a call / an email we sent by hand). Resets the chase
// clock (so the auto-chase doesn't fire straight after) without moving the
// court, and shows in the history as "Chased by …".
export async function logEnquiryChaseAction(input: {
  transactionId: string;
  method: "phone" | "email" | "other";
}): Promise<{ ok: boolean }> {
  const userId = await assertInScope(input.transactionId);
  const note =
    input.method === "phone" ? "Chased by phone"
      : input.method === "email" ? "Chased by email"
        : "Chased";
  const ok = await logEnquiryMovement({
    transactionId: input.transactionId,
    note,
    mode: "touch",
    kind: "chased",
    createdByUserId: userId,
  });
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok };
}

// Set (or clear) the expected-replies date. Reuses the "hold the chase until"
// mechanism — the date a solicitor gives IS the date we expect replies by.
export async function setEnquiryExpectedDateAction(input: {
  transactionId: string;
  date: string | null; // ISO date, or null to clear
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  if (input.date) {
    await setEnquirySnoozeUntil(input.transactionId, new Date(input.date));
  } else {
    await setEnquirySnooze(input.transactionId, null);
  }
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok: true };
}

// Load the chase-history timeline for one file's open loop (on row expand).
export async function getEnquiryHistoryAction(transactionId: string): Promise<EnquiryHistoryEntry[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];
  return getEnquiryHistory(getAccessScope(session), transactionId);
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

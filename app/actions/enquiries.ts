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
import { confirmMilestoneAction } from "./milestones";
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

// Mark the whole enquiries loop satisfied straight from the triage page. This is
// the real close, not a tracker-only flag: it confirms PM20 (buyer's "all
// enquiries satisfied"), which cascades to VM21 (the seller-side mirror) and
// closes the tracker via syncEnquiryTracker — the exact path the file milestone
// confirm runs. Delegating to confirmMilestoneAction (Law 4) means the exchange
// gate, the reminder re-eval, and the PM20 client email all stay correct rather
// than being re-implemented here. The tracker being open already implies PM14 is
// complete, so PM20's only prerequisite is satisfied.
export async function markEnquiriesSatisfiedAction(input: {
  transactionId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  await assertInScope(input.transactionId);
  const pm20 = await prisma.milestoneDefinition.findFirst({
    where: { code: "PM20" },
    select: { id: true },
  });
  if (!pm20) return { ok: false, reason: "PM20 milestone definition missing" };

  const res = await confirmMilestoneAction({
    transactionId: input.transactionId,
    milestoneDefinitionId: pm20.id,
  });
  // confirmMilestoneAction returns a { ok: false, kind: "prereqs_missing" }
  // shape when a direct prerequisite isn't committed yet, or its notifications
  // payload on success. Surface the former as a soft failure for the toast.
  if (res && typeof res === "object" && "ok" in res && res.ok === false) {
    return { ok: false, reason: "prereqs_missing" };
  }
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

"use server";

// Links the "survey booked" step to the quote requests raised for a file.
//
// When someone confirms the survey-booked step, they pick which surveyor the
// buyer actually booked. That flips the chosen firm's quote to `booked`, the
// other firms we quoted to `not_chosen` (neutral, not a loss — we still placed
// the business), or, if they booked outside our network, all our quotes to
// `lost`. "Not sure yet" leaves everything untouched (the surveyor is the
// backstop). Scoped to files the caller owns.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";

export type SurveyBookingOption = {
  quoteRequestId: string;
  firmName: string;
  status: string;
  submittedAt: string;
};

// The firms we sent quotes to for this file, so the confirm modal can list
// them. Empty array = no quote was requested → the picker is skipped and the
// step confirms normally.
export async function getSurveyBookingOptions(
  transactionId: string,
): Promise<SurveyBookingOption[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];

  const quotes = await prisma.quoteRequest.findMany({
    where: { transactionId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      provider: { select: { name: true } },
    },
  });

  return quotes.map((q) => ({
    quoteRequestId: q.id,
    firmName: q.provider.name,
    status: q.status,
    submittedAt: q.submittedAt.toISOString(),
  }));
}

export type SurveyBookingChoice =
  | { kind: "our_firm"; quoteRequestId: string }
  | { kind: "someone_else" }
  | { kind: "unknown" };

// Non-terminal statuses we're allowed to move. We never touch a quote that's
// already `won` (fee settled) or `expired`.
const MOVABLE = new Set(["pending", "booked", "not_chosen", "lost"]);

export async function recordSurveyBooking(input: {
  transactionId: string;
  choice: SurveyBookingChoice;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) return { ok: false, error: "File not found." };

  if (input.choice.kind === "unknown") {
    return { ok: true }; // nothing to record yet
  }

  const quotes = await prisma.quoteRequest.findMany({
    where: { transactionId: input.transactionId },
    select: { id: true, status: true },
  });
  const movable = quotes.filter((q) => MOVABLE.has(q.status));
  const now = new Date();

  if (input.choice.kind === "someone_else") {
    // Booked outside our network → every quote we sent is a real loss.
    await Promise.all(
      movable.map((q) =>
        prisma.quoteRequest.update({
          where: { id: q.id },
          data: {
            status: "lost",
            statusReason: "Booked outside our network",
            statusChangedAt: now,
            statusChangedById: session.user.id,
          },
        }),
      ),
    );
    revalidatePath("/command/providers/quotes");
    return { ok: true };
  }

  // our_firm — the chosen firm is booked; the rest are neutral "not chosen".
  const chosenId = input.choice.quoteRequestId;
  if (!movable.some((q) => q.id === chosenId)) {
    return { ok: false, error: "That quote is no longer available to book." };
  }

  await Promise.all(
    movable.map((q) =>
      prisma.quoteRequest.update({
        where: { id: q.id },
        data:
          q.id === chosenId
            ? {
                status: "booked",
                bookedAt: now,
                statusReason: null,
                statusChangedAt: now,
                statusChangedById: session.user.id,
              }
            : {
                status: "not_chosen",
                statusReason: "Buyer booked another of our firms",
                statusChangedAt: now,
                statusChangedById: session.user.id,
              },
      }),
    ),
  );

  revalidatePath("/command/providers/quotes");
  return { ok: true };
}

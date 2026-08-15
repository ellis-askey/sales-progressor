// Shared survey-booking logic, called by both the agent action
// (app/actions/survey-booking.ts, session-scoped) and the portal action
// (app/actions/portal.ts, token-scoped). Keeps the status rules in one place.

import { prisma } from "@/lib/prisma";

export type SurveyBookingOption = {
  quoteRequestId: string;
  firmName: string;
  status: string;
  submittedAt: string;
};

export type SurveyBookingChoice =
  | { kind: "our_firm"; quoteRequestId: string }
  | { kind: "someone_else" }
  | { kind: "unknown" };

// Non-terminal statuses we're allowed to move. Never touch a `won` (fee settled)
// or `expired` quote.
const MOVABLE = new Set(["pending", "booked", "not_chosen", "lost"]);

export async function getSurveyBookingOptionsForTx(
  transactionId: string,
): Promise<SurveyBookingOption[]> {
  const quotes = await prisma.quoteRequest.findMany({
    where: { transactionId },
    orderBy: { submittedAt: "desc" },
    select: { id: true, status: true, submittedAt: true, provider: { select: { name: true } } },
  });
  return quotes.map((q) => ({
    quoteRequestId: q.id,
    firmName: q.provider.name,
    status: q.status,
    submittedAt: q.submittedAt.toISOString(),
  }));
}

export async function applySurveyBooking(
  transactionId: string,
  choice: SurveyBookingChoice,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (choice.kind === "unknown") return { ok: true };

  const quotes = await prisma.quoteRequest.findMany({
    where: { transactionId },
    select: { id: true, status: true },
  });
  const movable = quotes.filter((q) => MOVABLE.has(q.status));
  const now = new Date();

  if (choice.kind === "someone_else") {
    await Promise.all(
      movable.map((q) =>
        prisma.quoteRequest.update({
          where: { id: q.id },
          data: { status: "lost", statusReason: "Booked outside our network", statusChangedAt: now, statusChangedById: actorUserId },
        }),
      ),
    );
    return { ok: true };
  }

  const chosenId = choice.quoteRequestId;
  if (!movable.some((q) => q.id === chosenId)) {
    return { ok: false, error: "That quote is no longer available to book." };
  }

  await Promise.all(
    movable.map((q) =>
      prisma.quoteRequest.update({
        where: { id: q.id },
        data:
          q.id === chosenId
            ? { status: "booked", bookedAt: now, statusReason: null, statusChangedAt: now, statusChangedById: actorUserId }
            : { status: "not_chosen", statusReason: "Buyer booked another of our firms", statusChangedAt: now, statusChangedById: actorUserId },
      }),
    ),
  );

  return { ok: true };
}

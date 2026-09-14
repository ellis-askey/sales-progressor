// Shared survey-booking logic, called by both the agent action
// (app/actions/survey-booking.ts, session-scoped) and the portal action
// (app/actions/portal.ts, token-scoped). Keeps the status rules in one place.

import { prisma } from "@/lib/prisma";
import { titleCaseKeepAcronyms } from "@/lib/utils";

export type SurveyBookingOption = {
  quoteRequestId: string;
  firmName: string;
  status: string;
  submittedAt: string;
};

export type SurveyBookingChoice =
  | { kind: "our_firm"; quoteRequestId: string }
  | { kind: "someone_else"; firmName?: string }
  | { kind: "unknown" };

// Non-terminal statuses we're allowed to move. Never touch a `won` (fee settled)
// or `expired` quote.
const MOVABLE = new Set(["pending", "booked", "not_chosen", "lost"]);

// "cameron   surveyors ltd" → "Cameron Surveyors Ltd". Tidies a typed firm name
// so it reads cleanly in the portal, the file and the email. Preserves acronyms
// the agent typed in caps (e.g. "AVB", "RICS") rather than mangling them to
// "Avb" — uses the canonical acronym-safe title-caser. Collapses whitespace.
export function titleCaseFirm(raw: string): string {
  return titleCaseKeepAcronyms(raw.replace(/\s+/g, " ").trim());
}

// The surveyor booked for a file: the chosen quote's firm (still booked or
// already won), else the free-text name captured for an out-of-network booking.
export async function getBookedSurveyorName(transactionId: string): Promise<string | null> {
  const booked = await prisma.quoteRequest.findFirst({
    where: { transactionId, status: { in: ["booked", "won"] } },
    orderBy: { bookedAt: "desc" },
    select: { provider: { select: { name: true } } },
  });
  if (booked?.provider.name) return booked.provider.name;
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { bookedSurveyorName: true },
  });
  return tx?.bookedSurveyorName ?? null;
}

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
    const typed = choice.firmName?.trim() ? titleCaseFirm(choice.firmName) : null;
    await Promise.all([
      ...movable.map((q) =>
        prisma.quoteRequest.update({
          where: { id: q.id },
          data: { status: "lost", statusReason: "Booked outside our network", statusChangedAt: now, statusChangedById: actorUserId },
        }),
      ),
      prisma.propertyTransaction.update({
        where: { id: transactionId },
        data: { bookedSurveyorName: typed },
      }),
    ]);
    return { ok: true };
  }

  const chosenId = choice.quoteRequestId;
  if (!movable.some((q) => q.id === chosenId)) {
    return { ok: false, error: "That quote is no longer available to book." };
  }

  // Booked one of ours — clear any stale out-of-network name.
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { bookedSurveyorName: null },
  });

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

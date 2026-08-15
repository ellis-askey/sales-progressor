"use server";

// Agent/progressor entry point for the survey-booking loop. Session-scoped:
// the caller must own the file. The status rules live in
// lib/services/survey-booking.ts so the portal (token-scoped) path shares them.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  getSurveyBookingOptionsForTx,
  applySurveyBooking,
  type SurveyBookingOption,
  type SurveyBookingChoice,
} from "@/lib/services/survey-booking";

export type { SurveyBookingOption, SurveyBookingChoice };

// The firms we sent quotes to for this file, so the confirm modal can list
// them. Empty = no quote requested → the picker is skipped.
export async function getSurveyBookingOptions(transactionId: string): Promise<SurveyBookingOption[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];
  return getSurveyBookingOptionsForTx(transactionId);
}

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

  const result = await applySurveyBooking(input.transactionId, input.choice, session.user.id);
  if (result.ok) revalidatePath("/command/providers/quotes");
  return result;
}

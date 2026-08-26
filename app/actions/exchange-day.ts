"use server";

// Server actions for the exchange-day overlay (Phase 2). Thin, scoped wrappers
// over lib/services/exchange-day.ts. Access is verified via the access-scope
// helper before acting (Law 7). See docs/active/exchange-day-SPEC.md.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { startExchangeDay, cancelExchangeDay } from "@/lib/services/exchange-day";
import { toUKDateStr } from "@/lib/utils";

export type ExchangeDayResult = { ok: true } | { ok: false; error: string };

async function guard(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  return { session, ok: !!tx };
}

export async function startExchangeDayAction(input: {
  transactionId: string;
  completionDate?: string | null;
  pathname: string;
}): Promise<ExchangeDayResult> {
  const { session, ok } = await guard(input.transactionId);
  if (!ok) return { ok: false, error: "File not found or not in your scope." };
  // A completion date in the past is never valid (completion is on/after
  // exchange). Client validates too; this is the defence-in-depth guard.
  if (input.completionDate && toUKDateStr(new Date(input.completionDate)) < toUKDateStr(new Date())) {
    return { ok: false, error: "The completion date can't be in the past." };
  }
  try {
    await startExchangeDay({
      transactionId: input.transactionId,
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      actorId: session.user.id,
      actorName: session.user.name ?? "",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't start exchange day." };
  }
  revalidatePath(input.pathname, "page");
  return { ok: true };
}

export async function cancelExchangeDayAction(input: {
  transactionId: string;
  pathname: string;
}): Promise<ExchangeDayResult> {
  const { session, ok } = await guard(input.transactionId);
  if (!ok) return { ok: false, error: "File not found or not in your scope." };
  await cancelExchangeDay({
    transactionId: input.transactionId,
    actorId: session.user.id,
    actorName: session.user.name ?? "",
  });
  revalidatePath(input.pathname, "page");
  return { ok: true };
}

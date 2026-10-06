"use server";

// Actions for the weekly "touch every file" card (critique 2026-10-05).
// A side is ticked off this week by logging a real touch (a call or an email),
// or parked with "not required this week". Sending from the composer and
// connected-mailbox ingestion already log an email, so those tick a side on
// their own; "I've emailed" is the manual catch for mail sent elsewhere.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";
import { createCommunicationRecord } from "@/lib/services/comms";
import type { Session } from "next-auth";

const SIDE_CLIENT: Record<string, string> = { vendor: "seller", purchaser: "buyer" };

// Next Monday 00:00 UTC — "not required" lasts until the week resets.
function endOfIsoWeekUTC(now: Date): Date {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day + 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function guard(transactionId: string): Promise<{ session: Session; scope: AccessScope } | null> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  return owned ? { session, scope } : null;
}

export async function markSideNotRequiredThisWeek(transactionId: string, side: "vendor" | "purchaser"): Promise<{ ok: boolean }> {
  const g = await guard(transactionId);
  if (!g) return { ok: false };
  const until = endOfIsoWeekUTC(new Date());
  await prisma.hubCardDismissal.upsert({
    where: { transactionId_cardKind_signature: { transactionId, cardKind: "weekly_touch", signature: side } },
    update: { dismissedUntil: until, dismissedById: g.session.user.id },
    create: { transactionId, cardKind: "weekly_touch", signature: side, dismissedUntil: until, dismissedById: g.session.user.id },
  });
  revalidatePath("/agent/to-do");
  return { ok: true };
}

export async function logSideCall(transactionId: string, side: "vendor" | "purchaser", contactIds: string[], note: string): Promise<{ ok: boolean }> {
  const g = await guard(transactionId);
  if (!g) return { ok: false };
  const text = note.trim() || `Call with the ${SIDE_CLIENT[side] ?? side}`;
  await createCommunicationRecord({
    transactionId, type: "outbound", method: "phone", contactIds,
    content: text, visibleToClient: false,
    createdById: g.session.user.id, createdByRole: g.session.user.role, scope: g.scope,
  });
  revalidatePath("/agent/to-do");
  return { ok: true };
}

export async function logSideEmailed(transactionId: string, side: "vendor" | "purchaser", contactIds: string[]): Promise<{ ok: boolean }> {
  const g = await guard(transactionId);
  if (!g) return { ok: false };
  await createCommunicationRecord({
    transactionId, type: "outbound", method: "email", contactIds,
    content: `Logged: emailed the ${SIDE_CLIENT[side] ?? side}.`, visibleToClient: false,
    createdById: g.session.user.id, createdByRole: g.session.user.role, scope: g.scope,
  });
  revalidatePath("/agent/to-do");
  return { ok: true };
}

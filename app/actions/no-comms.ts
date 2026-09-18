"use server";

// Per-side snooze for the To-Do "No comms" card. Unlike the fixed 14-day
// dismissHubCardAction, this takes a chosen window (quick hours or a date) and
// an optional reason, which is logged to the file's activity as an internal
// note — so there's always a record of the decision to wait. The snooze hides
// one side of one file (HubCardDismissal cardKind "no_comms", signature = the
// side); the getNoCommsFiles detector drops any side with a live dismissal.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { createCommunicationRecord } from "@/lib/services/comms";

const SIDE_LABEL: Record<string, string> = { vendor: "the seller", purchaser: "the buyer" };

export async function snoozeNoCommsSideAction(input: {
  transactionId: string;
  side: "vendor" | "purchaser";
  hours?: number;
  untilISO?: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Tenant safety (Law 7): confirm the file is in the caller's scope before
  // writing anything against it. Agents (director / negotiator) use this page
  // too, so we can't skip the ownership check.
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "File not found." };

  const until = input.untilISO
    ? new Date(input.untilISO)
    : new Date(Date.now() + (input.hours ?? 48) * 3_600_000);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { ok: false, error: "Pick a time in the future." };
  }

  await prisma.hubCardDismissal.upsert({
    where: {
      transactionId_cardKind_signature: {
        transactionId: input.transactionId,
        cardKind: "no_comms",
        signature: input.side,
      },
    },
    update: { dismissedUntil: until, dismissedById: session.user.id },
    create: {
      transactionId: input.transactionId,
      cardKind: "no_comms",
      signature: input.side,
      dismissedUntil: until,
      dismissedById: session.user.id,
    },
  });

  const reason = input.reason?.trim();
  if (reason) {
    // Internal note (never client-visible) so the wait, and why, is on the file.
    await createCommunicationRecord({
      transactionId: input.transactionId,
      type: "internal_note",
      method: null,
      contactIds: [],
      content: `Snoozed the No-comms nudge for ${SIDE_LABEL[input.side] ?? input.side}: ${reason}`,
      visibleToClient: false,
      createdById: session.user.id,
      createdByRole: session.user.role,
      scope,
    });
  }

  revalidatePath("/agent/to-do");
  return { ok: true };
}

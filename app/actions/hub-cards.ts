"use server";

// Dismiss (snooze) a row on the hub "Gone quiet" / "Mortgage offers expiring"
// cards. These surface computed signals that don't clear until the underlying
// situation does, so a handled file would otherwise nag forever. Dismissing
// hides that row for a snooze window; if it still applies afterwards it comes
// back. Internal-staff cards, so any authed internal user may dismiss.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SNOOZE_DAYS = 14;
const CARD_KINDS = new Set(["gone_quiet", "mortgage_expiry"]);

export async function dismissHubCardAction(input: {
  transactionId: string;
  cardKind: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!CARD_KINDS.has(input.cardKind)) return { ok: false, error: "Unknown card." };

  const until = new Date(Date.now() + SNOOZE_DAYS * 86_400_000);
  await prisma.hubCardDismissal.upsert({
    where: {
      transactionId_cardKind_signature: {
        transactionId: input.transactionId,
        cardKind: input.cardKind,
        signature: input.signature,
      },
    },
    update: { dismissedUntil: until, dismissedById: session.user.id },
    create: {
      transactionId: input.transactionId,
      cardKind: input.cardKind,
      signature: input.signature,
      dismissedUntil: until,
      dismissedById: session.user.id,
    },
  });

  revalidatePath("/agent/hub");
  return { ok: true };
}

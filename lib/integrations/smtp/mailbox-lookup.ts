// The routing lookup for mailbox sending: "does this From address belong to a
// connected mailbox that can send?" Kept separate from ./send so the sender
// resolver (lib/email/agency-sender.ts) and lib/email.ts can import it without
// pulling in the nodemailer / imapflow transport chain (server-only) — only an
// actual mailbox send lazy-loads that.

import { prisma } from "@/lib/prisma";
import type { ImapConnection } from "@prisma/client";

/**
 * The send-enabled, SMTP-verified connection for a bare email address, or null.
 * Most recently verified wins if the same mailbox is somehow connected twice
 * (it's unique per user, but two users could in theory connect a shared inbox).
 */
export async function findSendMailboxForAddress(address: string | null | undefined): Promise<ImapConnection | null> {
  const email = address?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return prisma.imapConnection.findFirst({
    where: { email, sendEnabled: true, smtpVerifiedAt: { not: null } },
    orderBy: { smtpVerifiedAt: "desc" },
  });
}

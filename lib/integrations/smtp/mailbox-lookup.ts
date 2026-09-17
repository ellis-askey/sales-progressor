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
 *
 * Two hard exclusions keep mailbox sending a SELF-MANAGED-only feature:
 *
 * 1. An agency's approved OUTSOURCED sender (Agency.quoteSenderEmail) never
 *    routes via a mailbox. Outsourced sending is our operation: it stays on
 *    SendGrid from the approved address (SP fallback when there is none),
 *    whatever inboxes anyone connects. (Founder decision, 2026-09-17.)
 * 2. An address whose domain is DNS-verified for the owner's agency never
 *    routes via a mailbox either — the verified domain is the stronger,
 *    analytics-carrying route, and "your domain takes priority" in the UI
 *    then describes the carrier as well as the address.
 */
export async function findSendMailboxForAddress(address: string | null | undefined): Promise<ImapConnection | null> {
  const email = address?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const conn = await prisma.imapConnection.findFirst({
    where: { email, sendEnabled: true, smtpVerifiedAt: { not: null } },
    orderBy: { smtpVerifiedAt: "desc" },
  });
  if (!conn) return null;

  const approvedOutsourced = await prisma.agency.findFirst({
    where: { quoteSenderEmail: { equals: email, mode: "insensitive" }, quoteSenderVerified: true },
    select: { id: true },
  });
  if (approvedOutsourced) return null;

  const domain = email.split("@")[1];
  if (domain) {
    const owner = await prisma.user.findUnique({ where: { id: conn.userId }, select: { agencyId: true } });
    if (owner?.agencyId) {
      const domainVerified = await prisma.verifiedDomain.findFirst({
        where: { agencyId: owner.agencyId, domain, status: "verified" },
        select: { id: true },
      });
      if (domainVerified) return null;
    }
  }

  return conn;
}

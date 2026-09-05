// lib/chain/invite-reminder.ts
//
// Day-14 "still moving" reminder for chain invites that still haven't been
// claimed — the second, richer follow-up after the 3-day nudge. Sits well clear
// of the nudge so the two never overlap, and stamps inviteChainReminderSentAt so
// each not-yet-joined neighbour gets at most one. Reuses the existing invite
// token (never regenerates it) and respects unsubscribes/bounces/expiry.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveChainInviteSender } from "@/lib/chain/invite";
import { normaliseAddressString } from "@/lib/utils/address";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { buildChainStillMoving } from "@/lib/emails/chain-still-moving";
import { buildInviteUnsubscribeUrl } from "@/lib/email/unsubscribe";

// Wait this many days after the invite before the "still moving" reminder — long
// enough to be clear of the 3-day nudge, comfortably inside the 60-day token.
const REMINDER_AFTER_DAYS = 14;

function splitAddress(a: string): { line1: string; line2?: string } {
  const i = a.indexOf(",");
  return i === -1 ? { line1: a } : { line1: a.slice(0, i).trim(), line2: a.slice(i + 1).trim() };
}

export async function sendDueChainReminders(now: Date = new Date()): Promise<{ candidates: number; sent: number }> {
  const cutoff = new Date(now.getTime() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const links = await prisma.chainLink.findMany({
    where: {
      inviteStatus: "SENT", // not claimed, declined or bounced
      inviteChainReminderSentAt: null, // at most one reminder
      transactionId: null, // not joined
      inviteBouncedAt: null,
      inviteUnsubscribedAt: null, // respect an unsubscribe
      inviteToken: { not: null },
      stubAgentEmail: { not: null },
      inviteSentAt: { lte: cutoff },
      OR: [{ inviteTokenExpiresAt: null }, { inviteTokenExpiresAt: { gt: now } }], // not expired
    },
    select: {
      id: true,
      inviteToken: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
      chain: {
        select: {
          createdBy: { select: { name: true, firmName: true, agencyId: true } },
          links: {
            select: {
              transactionId: true,
              withdrawalStatus: true,
              transaction: { select: { status: true, propertyAddress: true } },
            },
          },
        },
      },
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  let sent = 0;

  for (const link of links) {
    const broken = link.chain.links.some(
      (l) => l.withdrawalStatus === "WITHDRAWN" || l.transaction?.status === "withdrawn",
    );
    if (broken) continue;
    if (!link.inviteToken || !link.stubAgentEmail) continue;

    const claimUrl = `${base}/claim?token=${link.inviteToken}`;
    const declineUrl = `${base}/claim/decline?token=${link.inviteToken}`;
    const { line1, line2 } = splitAddress(normaliseAddressString(link.stubPropertyAddress ?? "your sale"));

    const originatorLink = link.chain.links.find((l) => l.transactionId);
    const originatingAddress = normaliseAddressString(originatorLink?.transaction?.propertyAddress ?? "a connected sale");
    const { from, replyTo, displayAgency } = await resolveChainInviteSender(originatorLink?.transactionId ?? null, {
      name: link.chain.createdBy?.name ?? "An agent",
      agencyId: link.chain.createdBy?.agencyId ?? null,
      agencyName: link.chain.createdBy?.firmName ?? "their agency",
    });

    const { subject, html, text } = buildChainStillMoving({
      addressLine1: line1,
      addressLine2: line2,
      originatingAddress,
      chainUrl: claimUrl,
      declineUrl,
      unsubscribeUrl: buildInviteUnsubscribeUrl(link.id),
    });

    try {
      await sendAgentEmail({ to: link.stubAgentEmail, subject, html, text, from, replyTo, kind: "chain_invite_nudge", meta: { originatorAgency: displayAgency, reminder: "day14" } });
      await prisma.chainLink.update({ where: { id: link.id }, data: { inviteChainReminderSentAt: now } });
      await trackServerEvent(`chain-invite-${link.id}`, ANALYTICS_EVENTS.CHAIN_INVITE_NUDGED, { linkId: link.id, kind: "reminder" });
      sent++;
    } catch (err) {
      console.error(`[chain-invite-reminder] send failed for link ${link.id}:`, err);
    }
  }

  return { candidates: links.length, sent };
}

// lib/chain/invite-nudge.ts
//
// One-time reminder ("nudge") for chain invites that were delivered but never
// opened. Gives every invite a real second chance, which is the cheapest lift in
// the funnel. Driven by a daily cron. Uses the funnel data from Phase 0
// (inviteFirstViewedAt) to target only the agents who never clicked through.
//
// Key rule: the nudge REUSES the existing invite token — it never regenerates it,
// so the original email's link keeps working. It just emails the same link again
// with the redesigned reminder template. Each invite gets at most one nudge
// (inviteNudgedAt guards it), and unsubscribed neighbours are skipped.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveChainInviteSender } from "@/lib/chain/invite";
import { normaliseAddressString } from "@/lib/utils/address";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { buildChainInvite } from "@/lib/emails/chain-invite";
import { buildInviteUnsubscribeUrl } from "@/lib/email/unsubscribe";

// Wait this many days after the invite was sent before nudging. Long enough that
// it isn't naggy, short enough that the chain is still live.
const NUDGE_AFTER_DAYS = 3;

// "8 Birchwood Close, Guildford, GU1 3RF" → line 1 street, line 2 the rest.
function splitAddress(a: string): { line1: string; line2?: string } {
  const i = a.indexOf(",");
  return i === -1 ? { line1: a } : { line1: a.slice(0, i).trim(), line2: a.slice(i + 1).trim() };
}

export async function sendDueChainInviteNudges(now: Date = new Date()): Promise<{ candidates: number; sent: number }> {
  const cutoff = new Date(now.getTime() - NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const links = await prisma.chainLink.findMany({
    where: {
      inviteStatus: "SENT", // not claimed, declined or bounced
      inviteFirstViewedAt: null, // never opened the chain page
      inviteNudgedAt: null, // not already nudged
      transactionId: null, // not claimed
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
      stubAgencyName: true,
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
    // Skip a chain that has broken since the invite went out — the claim page
    // would only show a "this chain has changed" dead end, so don't nudge into it.
    const broken = link.chain.links.some(
      (l) => l.withdrawalStatus === "WITHDRAWN" || l.transaction?.status === "withdrawn",
    );
    if (broken) continue;
    if (!link.inviteToken || !link.stubAgentEmail) continue;

    const claimUrl = `${base}/claim?token=${link.inviteToken}`;
    const declineUrl = `${base}/claim/decline?token=${link.inviteToken}`;
    const { line1, line2 } = splitAddress(normaliseAddressString(link.stubPropertyAddress ?? "your sale"));

    // Brand from the originating file (customer agency + right persona), the same
    // way the invite does. See resolveChainInviteSender.
    const originatorLink = link.chain.links.find((l) => l.transactionId);
    const originatingAddress = normaliseAddressString(originatorLink?.transaction?.propertyAddress ?? "a connected sale");
    const { from, replyTo, displayAgency } = await resolveChainInviteSender(originatorLink?.transactionId ?? null, {
      name: link.chain.createdBy?.name ?? "An agent",
      agencyId: link.chain.createdBy?.agencyId ?? null,
      agencyName: link.chain.createdBy?.firmName ?? "their agency",
    });

    const { subject, html, text } = buildChainInvite({
      addressLine1: line1,
      addressLine2: line2,
      originatingAddress,
      chainUrl: claimUrl,
      declineUrl,
      unsubscribeUrl: buildInviteUnsubscribeUrl(link.id),
    });

    try {
      await sendAgentEmail({ to: link.stubAgentEmail, subject, html, text, from, replyTo, kind: "chain_invite_nudge", meta: { originatorAgency: displayAgency } });
      await prisma.chainLink.update({ where: { id: link.id }, data: { inviteNudgedAt: now } });
      await trackServerEvent(`chain-invite-${link.id}`, ANALYTICS_EVENTS.CHAIN_INVITE_NUDGED, { linkId: link.id });
      sent++;
    } catch (err) {
      console.error(`[chain-invite-nudge] send failed for link ${link.id}:`, err);
    }
  }

  return { candidates: links.length, sent };
}

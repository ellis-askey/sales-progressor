// lib/chain/invite-nudge.ts
//
// One-time reminder ("nudge") for chain invites that were delivered but never
// opened. Gives every invite a real second chance, which is the cheapest lift in
// the funnel. Driven by a daily cron. Uses the funnel data from Phase 0
// (inviteFirstViewedAt) to target only the agents who never clicked through.
//
// Key rule: the nudge REUSES the existing invite token — it never regenerates it,
// so the original email's link keeps working. It just emails the same link again
// with gentler, reminder-framed copy. Each invite gets at most one nudge
// (inviteNudgedAt guards it).

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveChainInviteSender } from "@/lib/chain/invite";
import { normaliseAddressString } from "@/lib/utils/address";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

// Wait this many days after the invite was sent before nudging. Long enough that
// it isn't naggy, short enough that the chain is still live.
const NUDGE_AFTER_DAYS = 3;

export async function sendDueChainInviteNudges(now: Date = new Date()): Promise<{ candidates: number; sent: number }> {
  const cutoff = new Date(now.getTime() - NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const links = await prisma.chainLink.findMany({
    where: {
      inviteStatus: "SENT", // not claimed, declined or bounced
      inviteFirstViewedAt: null, // never opened the chain page
      inviteNudgedAt: null, // not already nudged
      transactionId: null, // not claimed
      inviteBouncedAt: null,
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
              transaction: { select: { status: true } },
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
    const recipientName = link.stubAgencyName ?? "there";
    const stubAddress = normaliseAddressString(link.stubPropertyAddress ?? "your sale");
    // Brand from the originating file (customer agency + right persona), the same
    // way the invite does. See resolveChainInviteSender.
    const originatorTxId = link.chain.links.find((l) => l.transactionId)?.transactionId ?? null;
    const { from, replyTo, displayFirstName, displayAgency } = await resolveChainInviteSender(originatorTxId, {
      name: link.chain.createdBy?.name ?? "An agent",
      agencyId: link.chain.createdBy?.agencyId ?? null,
      agencyName: link.chain.createdBy?.firmName ?? "their agency",
    });
    const originatorName = displayFirstName;
    const originatorAgency = displayAgency;

    const { subject, html, text } = buildNudgeEmail({
      recipientName,
      originatorName,
      originatorAgency,
      stubAddress,
      claimUrl,
      declineUrl,
    });

    try {
      await sendAgentEmail({ to: link.stubAgentEmail, subject, html, text, from, replyTo, kind: "chain_invite_nudge", meta: { originatorAgency } });
      await prisma.chainLink.update({ where: { id: link.id }, data: { inviteNudgedAt: now } });
      await trackServerEvent(`chain-invite-${link.id}`, ANALYTICS_EVENTS.CHAIN_INVITE_NUDGED, { linkId: link.id });
      sent++;
    } catch (err) {
      console.error(`[chain-invite-nudge] send failed for link ${link.id}:`, err);
    }
  }

  return { candidates: links.length, sent };
}

function buildNudgeEmail(v: {
  recipientName: string;
  originatorName: string;
  originatorAgency: string;
  stubAddress: string;
  claimUrl: string;
  declineUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `A reminder from ${v.originatorAgency}: your chain is ready to view`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">Reminder</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">Your place in the chain is still saved</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hello ${v.recipientName},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">A little while ago, ${v.originatorName} at ${v.originatorAgency} added your sale at <strong>${v.stubAddress}</strong> to a live chain on Sales Progressor. It's still active, and your view of the chain is ready whenever you'd like to take a look.</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">You can see how each sale is progressing, what's still outstanding and where the chain is currently waiting. It's simply a clearer way to keep up with the whole chain without having to chase everyone for updates.</p>
  <p style="margin:0 0 28px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">See the chain</a>
  </p>
  <p style="margin:0 0 16px;font-size:12px;color:#8b91a3">If the button doesn't work, copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Not the right agent for this sale? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">Let us know</a> and we'll stop.</p>
  <p style="margin:0;font-size:12px;color:#8b91a3">Need help? <a href="mailto:support@thesalesprogressor.co.uk" style="color:#8b91a3">support@thesalesprogressor.co.uk</a></p>
  <p style="margin:24px 0 0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</div>
</body></html>`;

  const text = `Hello ${v.recipientName},

A little while ago, ${v.originatorName} at ${v.originatorAgency} added your sale at ${v.stubAddress} to a live chain on Sales Progressor. It's still active, and your view of the chain is ready whenever you'd like to take a look.

You can see how each sale is progressing, what's still outstanding and where the chain is currently waiting. It's simply a clearer way to keep up with the whole chain without having to chase everyone for updates.

See the chain: ${v.claimUrl}

Not the right agent for this sale? Let us know and we'll stop: ${v.declineUrl}

Need help? support@thesalesprogressor.co.uk
`;

  return { subject, html, text };
}

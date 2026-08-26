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
import { agencyLogoBand } from "@/lib/email/agency-logo-band";
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

    const logoBand = await agencyLogoBand(link.chain.createdBy?.agencyId ?? null);

    const { subject, html, text } = buildNudgeEmail({
      recipientName,
      originatorName,
      originatorAgency,
      stubAddress,
      claimUrl,
      declineUrl,
      logoUrl: `${base}/logo.png`,
      logoBand,
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
  logoUrl: string;
  logoBand: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your chain is still live";

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">${v.logoBand}
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:30px 32px 26px;border-radius:0 0 24px 24px">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
    <td style="vertical-align:middle">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8)">Quick reminder</p>
      <h1 style="margin:0;font-size:23px;font-weight:700;color:#fff;line-height:1.2">Your chain is still live</h1>
    </td>
    <td style="vertical-align:middle;text-align:right;width:60px">
      <svg width="52" height="52" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block">
        <path d="M20 24 C20 19 23 16 28 16 C33 16 36 19 36 24 C36 30 39 33 39 33 H17 C17 33 20 30 20 24 Z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        <path d="M25 37 C25 39 26 40 28 40 C30 40 31 39 31 37" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        <circle cx="38" cy="18" r="5" fill="#FF3B30" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    </td>
  </tr></table>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hi ${v.recipientName},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">A little while ago, ${v.originatorName} at ${v.originatorAgency} invited you to join the live chain connected to your sale at <strong>${v.stubAddress}</strong>.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">It's still active, so your view is still there whenever you need it.</p>
  <p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:#4a5162">You'll be able to see where each sale has reached, what's outstanding and where the chain is currently waiting, alongside the other agents involved.</p>
  <p style="margin:0 0 26px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">View the chain</a>
  </p>
  <p style="margin:0 0 22px;font-size:12px;color:#8b91a3">Button not working? Copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 22px;font-size:12px;color:#8b91a3">Not the right agent for this sale? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">Let us know</a> and we'll stop.</p>
  <hr style="border:none;border-top:1px solid #eef0f4;margin:0 0 16px"/>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
    <td style="vertical-align:middle;width:34px"><img src="${v.logoUrl}" width="28" height="28" alt="Sales Progressor" style="display:block;border-radius:7px"/></td>
    <td style="vertical-align:middle;padding-left:10px">
      <p style="margin:0;font-size:13px;font-weight:700;color:#1a1d29">Sales Progressor</p>
      <p style="margin:1px 0 0;font-size:12px;color:#8b91a3">Making property moves better for everyone.</p>
    </td>
  </tr></table>
</div>
</body></html>`;

  const text = `Hi ${v.recipientName},

A little while ago, ${v.originatorName} at ${v.originatorAgency} invited you to join the live chain connected to your sale at ${v.stubAddress}.

It's still active, so your view is still there whenever you need it.

You'll be able to see where each sale has reached, what's outstanding and where the chain is currently waiting, alongside the other agents involved.

View the chain: ${v.claimUrl}

Not the right agent for this sale? Let us know and we'll stop: ${v.declineUrl}

Sales Progressor
Making property moves better for everyone.
`;

  return { subject, html, text };
}

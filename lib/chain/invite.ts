// lib/chain/invite.ts
// Chain invite email sending, decline, and bounce handling.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender, resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { stripAgencyLegalSuffix } from "@/lib/email/from-name";
import { displayChainPosition } from "@/lib/chain/positions";
import { normaliseAddressString } from "@/lib/utils/address";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import crypto from "crypto";

type LinkForInvite = {
  id: string;
  stubAgentEmail: string | null;
  stubAgentName: string | null;
  stubPropertyAddress: string | null;
  stubAgencyName: string | null;
  inviteStatus: string;
  inviteResendCount: number;
  chain: {
    createdByUserId: string | null;
    links: Array<{
      position: number;
      transactionId: string | null;
      transaction: { propertyAddress: string } | null;
      stubPropertyAddress: string | null;
    }>;
  };
};

export type SendChainInviteInput = {
  link: LinkForInvite;
  sentByUserId: string;
  sentByName: string;
};

// Generates a fresh invite token, updates the link, and sends the email.
export async function sendChainInvite(input: SendChainInviteInput): Promise<void> {
  const { link, sentByUserId } = input;
  if (!link.stubAgentEmail) throw new Error("No email on stub — cannot send invite");

  const token = crypto.randomBytes(32).toString("hex");
  const isResend = link.inviteResendCount > 0;
  // Long window so a busy agent doesn't lose the invite just because they were
  // away for a week. Was 7 days (14 on resend), which quietly binned invites.
  // See docs/active/chain-invite-conversion — Phase 2.
  const EXPIRY_DAYS = 60;
  const inviteTokenExpiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.chainLink.update({
    where: { id: link.id },
    data: {
      inviteToken: token,
      inviteTokenExpiresAt,
      inviteStatus: "SENT",
      inviteSentAt: new Date(),
      lastInviteSentByUserId: sentByUserId,
      inviteResendCount: { increment: 1 },
    },
  });

  await sendInviteEmail({ link, token, sentByName: input.sentByName });

  // Funnel: top of the chain-invite funnel. distinctId is the sending agent so
  // this stitches to their profile; the invited agent is still just a stub.
  await trackServerEvent(sentByUserId, ANALYTICS_EVENTS.CHAIN_INVITE_SENT, {
    linkId: link.id,
    isResend,
  });
}

// Resolve who a chain invite (or its nudge) comes from. Brands from the
// ORIGINATING FILE, not from whoever clicked "invite" — so it is always the
// customer agency (never "Sales Progressor"), with the right persona:
//   self-managed -> the agency's own agent   ("{first} at {Agency}")
//   outsourced   -> the assigned progressor   ("{first} at {Agency}")
// The from-address follows the agency sender policy (the agency's verified
// address, else the established fallback). Only falls back to the sending user's
// own agency when there is no originating file. See docs/active/chain-invite-conversion.
export async function resolveChainInviteSender(
  originatorTransactionId: string | null,
  fallback: { name: string; agencyId: string | null; agencyName: string },
): Promise<{ from: string; replyTo: string; displayFirstName: string; displayAgency: string }> {
  const firstOf = (n: string) => n.trim().split(/\s+/)[0] || n;

  if (originatorTransactionId) {
    const otx = await prisma.propertyTransaction.findUnique({
      where: { id: originatorTransactionId },
      select: {
        serviceType: true,
        agency: { select: { name: true } },
        assignedUser: { select: { name: true } },
        agentUser: { select: { name: true } },
      },
    });
    if (otx) {
      const { from, replyTo } = await resolveAgencySenderForTransaction(originatorTransactionId);
      const personaName =
        (otx.serviceType === "self_managed" ? otx.agentUser?.name : otx.assignedUser?.name) ?? fallback.name;
      const displayAgency = otx.agency?.name ? stripAgencyLegalSuffix(otx.agency.name) : fallback.agencyName;
      return { from, replyTo, displayFirstName: firstOf(personaName), displayAgency };
    }
  }

  // No originating file (shouldn't happen for a real chain) — brand from the
  // sending user's own agency, as before.
  const { from, replyTo } = await resolveAgencySender(
    fallback.agencyId,
    fallback.name ? { personFirstName: firstOf(fallback.name) } : undefined,
  );
  return { from, replyTo, displayFirstName: firstOf(fallback.name), displayAgency: fallback.agencyName };
}

// Looks up any extra context needed and sends the HTML + plain-text invite email.
async function sendInviteEmail(input: {
  link: LinkForInvite;
  token: string;
  sentByName: string;
}): Promise<void> {
  const { link, token, sentByName } = input;
  if (!link.stubAgentEmail) return;

  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  const claimUrl = `${base}/claim?token=${token}`;
  const declineUrl = `${base}/claim/decline?token=${token}`;

  // Look up originator's agency name
  const originator = link.chain.createdByUserId
    ? await prisma.user.findUnique({
        where: { id: link.chain.createdByUserId },
        select: { name: true, firmName: true, agencyId: true },
      })
    : null;

  // Fallback identity, used only if there's no originating file to brand from.
  const fallbackName = originator?.name ?? sentByName;
  const fallbackAgency = originator?.firmName ?? sentByName;

  // Look up stub's own position and originator's position in chain
  const stubRecord = await prisma.chainLink.findUnique({
    where: { id: link.id },
    select: { position: true },
  });
  const stubPosition = stubRecord?.position ?? 0;

  const originatorLink = link.chain.links.find((l) => l.transactionId !== null);
  const originatorPosition = originatorLink?.position ?? 0;
  // Render-time postcode normalisation — write-time normalisation catches
  // anything new; this catches historical rows persisted before the fix
  // so existing chains still render with canonical UK postcode form.
  const originatorAddress = normaliseAddressString(
    originatorLink?.transaction?.propertyAddress ?? "a property",
  );

  // Brand the invite from the ORIGINATING FILE (always the customer agency, never
  // "Sales Progressor") with the right persona. See resolveChainInviteSender.
  const sender = await resolveChainInviteSender(originatorLink?.transactionId ?? null, {
    name: fallbackName,
    agencyId: originator?.agencyId ?? null,
    agencyName: fallbackAgency,
  });
  const originatorName = sender.displayFirstName;
  const originatorAgency = sender.displayAgency;

  const stubAddress = normaliseAddressString(link.stubPropertyAddress ?? "your sale");
  const positionDesc =
    stubPosition < originatorPosition ? "sale above" : "sale below";

  const totalLinks = link.chain.links.length;
  const linkPosition = displayChainPosition(stubPosition, totalLinks); // bottom=#1 convention
  const claimedCount = link.chain.links.filter((l) => l.transactionId !== null).length;
  const recipientName = link.stubAgencyName ?? "there";

  const subject = `${originatorAgency} has added you to a live chain: ${originatorAddress}`;

  const html = buildInviteHtml({
    recipientName,
    originatorName,
    originatorAgency,
    originatorAddress,
    stubAddress,
    positionDesc,
    linkPosition,
    totalLinks,
    claimedCount,
    claimUrl,
    declineUrl,
  });

  const text = buildInviteText({
    recipientName,
    originatorName,
    originatorAgency,
    originatorAddress,
    stubAddress,
    positionDesc,
    linkPosition,
    totalLinks,
    claimedCount,
    claimUrl,
    declineUrl,
  });

  // External agent (unclaimed stub): no recipient user id, so userId stays null
  // and we key the log off the email address only.
  // Send from the originator agency's authenticated address (Reply-To matching),
  // SP fallback when they have none.
  await sendAgentEmail({ to: link.stubAgentEmail, subject, html, text, from: sender.from, replyTo: sender.replyTo, kind: "chain_invite", meta: { originatorAgency } });
}

function buildInviteHtml(v: {
  recipientName: string;
  originatorName: string;
  originatorAgency: string;
  originatorAddress: string;
  stubAddress: string;
  positionDesc: string;
  linkPosition: number;
  totalLinks: number;
  claimedCount: number;
  claimUrl: string;
  declineUrl: string;
}): string {
  const claimedSuffix = v.claimedCount === 1 ? "agent is" : "agents are";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">Chain invite</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">You've been added to a live chain</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hello ${v.recipientName},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">${v.originatorName} at ${v.originatorAgency} has added you to a live sales chain on Sales Progressor.</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">They're tracking the sale of <strong>${v.originatorAddress}</strong> and have linked your sale at <strong>${v.stubAddress}</strong> as the ${v.positionDesc}.</p>
  <div style="margin:0 0 24px;padding:16px 20px;background:#FFF8F6;border-left:3px solid #FF6B4A;border-radius:8px">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a1d29">You're #${v.linkPosition} of ${v.totalLinks} in this chain</p>
    <p style="margin:0;font-size:12px;color:#8b91a3">${v.claimedCount} ${claimedSuffix} already tracking this chain together</p>
  </div>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">Claim your place and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.</p>
  <p style="margin:0 0 28px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Claim this sale</a>
  </p>
  <p style="margin:0 0 16px;font-size:12px;color:#8b91a3">If the button doesn't work, copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Not the right agent for this sale? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">Decline this invite →</a></p>
  <p style="margin:0;font-size:12px;color:#8b91a3">Need help? <a href="mailto:support@thesalesprogressor.co.uk" style="color:#8b91a3">support@thesalesprogressor.co.uk</a></p>
  <p style="margin:24px 0 0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</div>
</body></html>`;
}

function buildInviteText(v: {
  recipientName: string;
  originatorName: string;
  originatorAgency: string;
  originatorAddress: string;
  stubAddress: string;
  positionDesc: string;
  linkPosition: number;
  totalLinks: number;
  claimedCount: number;
  claimUrl: string;
  declineUrl: string;
}): string {
  return `Hello ${v.recipientName},

${v.originatorName} at ${v.originatorAgency} has added you to a live sales chain on Sales Progressor.

They're tracking the sale of ${v.originatorAddress} and have linked your sale at ${v.stubAddress} as the ${v.positionDesc}.

You're #${v.linkPosition} of ${v.totalLinks} in this chain. ${v.claimedCount} agent${v.claimedCount !== 1 ? "s are" : " is"} already tracking it together.

Claim your place and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.

Claim this sale: ${v.claimUrl}

Not the right agent for this sale? Decline this invite: ${v.declineUrl}

Need help? support@thesalesprogressor.co.uk
`;
}

// Called by the SendGrid bounce webhook when a hard bounce is received.
// Updates the link status and notifies the originator.
export async function handleBouncedInvite(email: string): Promise<void> {
  const link = await prisma.chainLink.findFirst({
    where: {
      stubAgentEmail: email,
      inviteStatus: "SENT",
      inviteBouncedAt: null,
    },
    select: {
      id: true,
      stubPropertyAddress: true,
      chain: {
        select: {
          createdByUserId: true,
          createdBy: { select: { email: true, name: true, firmName: true, agencyId: true } },
        },
      },
    },
  });

  if (!link) return;

  await prisma.chainLink.update({
    where: { id: link.id },
    data: { inviteStatus: "BOUNCED", inviteBouncedAt: new Date() },
  });

  // One-time email to originator on first bounce
  const originatorEmail = link.chain.createdBy?.email;
  const originatorName = link.chain.createdBy?.name ?? "there";
  const address = link.stubPropertyAddress ?? "a sale in your chain";

  if (originatorEmail) {
    const bounceSender = await resolveAgencySender(link.chain.createdBy?.agencyId ?? null);
    await sendEmail({
      to: originatorEmail,
      subject: `Chain invite to ${email} couldn't be delivered`,
      text: `Hi ${originatorName},\n\nThe chain invite you sent to ${email} for ${address} bounced. The email address couldn't be reached.\n\nMost often this is a typo. Open the chain on the file to update the address and resend.\n\nsupport@thesalesprogressor.co.uk`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 16px;font-size:15px">Hi ${originatorName},</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">The chain invite you sent to <strong>${email}</strong> for <strong>${address}</strong> bounced. The email address couldn't be reached.</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">Most often this is a typo. Open the chain on the file to update the address and resend.</p>
<p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Need help? <a href="mailto:support@thesalesprogressor.co.uk" style="color:#8b91a3">support@thesalesprogressor.co.uk</a></p>
<p style="margin:0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</body></html>`,
      from: bounceSender.from,
      replyTo: bounceSender.replyTo,
    }).catch(console.error);
  }
}

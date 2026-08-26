// lib/chain/invite.ts
// Chain invite email sending, decline, and bounce handling.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender, resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { agencyLogoBand } from "@/lib/email/agency-logo-band";
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
  const logoUrl = `${base}/logo.png`;

  const totalLinks = link.chain.links.length;
  const linkPosition = displayChainPosition(stubPosition, totalLinks); // bottom=#1 convention
  const claimedCount = link.chain.links.filter((l) => l.transactionId !== null).length;
  const recipientName = link.stubAgencyName ?? "there";

  const subject = "You're part of a live chain";

  // Agency logo band (Option B) for the originating agency, above the coral hero.
  const logoBand = await agencyLogoBand(originator?.agencyId ?? null);

  const html = buildInviteHtml({
    recipientName,
    originatorName,
    originatorAgency,
    originatorAddress,
    stubAddress,
    linkPosition,
    totalLinks,
    claimedCount,
    claimUrl,
    declineUrl,
    logoUrl,
    logoBand,
  });

  const text = buildInviteText({
    recipientName,
    originatorName,
    originatorAgency,
    originatorAddress,
    stubAddress,
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
  linkPosition: number;
  totalLinks: number;
  claimedCount: number;
  claimUrl: string;
  declineUrl: string;
  logoUrl: string;
  logoBand: string;
}): string {
  const connected = v.claimedCount === 1 ? "1 agent is already connected" : `${v.claimedCount} agents are already connected`;
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">${v.logoBand}
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:30px 32px 26px;border-radius:0 0 24px 24px">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
    <td style="vertical-align:middle">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8)">Chain invite</p>
      <h1 style="margin:0;font-size:23px;font-weight:700;color:#fff;line-height:1.2">You're part of a live chain</h1>
    </td>
    <td style="vertical-align:middle;text-align:right;width:66px">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block">
        <path d="M8 27 L16 20 L24 27 V35 H8 Z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        <path d="M32 27 L40 20 L48 27 V35 H32 Z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        <line x1="25" y1="31" x2="31" y2="31" stroke="#ffffff" stroke-width="2" stroke-dasharray="1 3" stroke-linecap="round"/>
      </svg>
    </td>
  </tr></table>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hi ${v.recipientName},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">${v.originatorName} at ${v.originatorAgency} is progressing the sale of <strong>${v.originatorAddress}</strong>, which is connected to your sale at <strong>${v.stubAddress}</strong>.</p>
  <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#4a5162">They've added the chain to Sales Progressor and invited you to join them.</p>
  <div style="margin:0 0 22px;padding:14px 18px;background:#FFF8F6;border-left:3px solid #FF6B4A;border-radius:8px">
    <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#1a1d29">You're #${v.linkPosition} of ${v.totalLinks} in the chain</p>
    <p style="margin:0;font-size:12px;color:#8b91a3">${connected}</p>
  </div>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">Once you're in, you'll both have the same live view of the chain: where each sale has reached, what's outstanding and where things are currently waiting.</p>
  <p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:#4a5162">No more ringing around just to piece together the same picture.</p>
  <p style="margin:0 0 26px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">View the chain</a>
  </p>
  <p style="margin:0 0 22px;font-size:12px;color:#8b91a3">Button not working? Copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 22px;font-size:12px;color:#8b91a3">Not the right agent for this sale? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">Let us know</a>.</p>
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
}

function buildInviteText(v: {
  recipientName: string;
  originatorName: string;
  originatorAgency: string;
  originatorAddress: string;
  stubAddress: string;
  linkPosition: number;
  totalLinks: number;
  claimedCount: number;
  claimUrl: string;
  declineUrl: string;
}): string {
  return `Hi ${v.recipientName},

${v.originatorName} at ${v.originatorAgency} is progressing the sale of ${v.originatorAddress}, which is connected to your sale at ${v.stubAddress}.

They've added the chain to Sales Progressor and invited you to join them.

You're #${v.linkPosition} of ${v.totalLinks} in the chain. ${v.claimedCount === 1 ? "1 agent is" : `${v.claimedCount} agents are`} already connected.

Once you're in, you'll both have the same live view of the chain: where each sale has reached, what's outstanding and where things are currently waiting. No more ringing around just to piece together the same picture.

View the chain: ${v.claimUrl}

Not the right agent for this sale? Let us know: ${v.declineUrl}

Sales Progressor
Making property moves better for everyone.
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

// lib/chain/invite.ts
// Chain invite email sending, decline, and bounce handling.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { agencyFrom } from "@/lib/email/from-name";
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
  const expiryDays = isResend ? 14 : 7;
  const inviteTokenExpiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

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
        select: { name: true, firmName: true },
      })
    : null;

  const originatorName = originator?.name ?? sentByName;
  const originatorAgency = originator?.firmName ?? sentByName;

  // Look up stub's own position and originator's position in chain
  const stubRecord = await prisma.chainLink.findUnique({
    where: { id: link.id },
    select: { position: true },
  });
  const stubPosition = stubRecord?.position ?? 0;

  const originatorLink = link.chain.links.find((l) => l.transactionId !== null);
  const originatorPosition = originatorLink?.position ?? 0;
  const originatorAddress =
    originatorLink?.transaction?.propertyAddress ?? "a property";

  const stubAddress = link.stubPropertyAddress ?? "your sale";
  const positionDesc =
    stubPosition < originatorPosition ? "sale above" : "sale below";

  const totalLinks = link.chain.links.length;
  const linkPosition = stubPosition + 1; // 1-indexed for display
  const claimedCount = link.chain.links.filter((l) => l.transactionId !== null).length;
  const recipientName = link.stubAgencyName ?? "there";

  const subject = `${originatorAgency} has added you to a live chain — ${originatorAddress}`;

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

  await sendEmail({ to: link.stubAgentEmail, subject, html, text, from: agencyFrom(originatorAgency) });
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
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">Claim your spot and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.</p>
  <p style="margin:0 0 28px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Claim this sale</a>
  </p>
  <p style="margin:0 0 16px;font-size:12px;color:#8b91a3">If the button doesn't work, copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Not the right agent? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">This isn't mine →</a></p>
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

Claim your spot and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.

Claim this sale: ${v.claimUrl}

Not the right agent? Decline here: ${v.declineUrl}

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
          createdBy: { select: { email: true, name: true, firmName: true } },
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
    await sendEmail({
      to: originatorEmail,
      subject: `Chain invite to ${email} couldn't be delivered`,
      text: `Hi ${originatorName},\n\nThe chain invite you sent to ${email} for ${address} bounced — the email address couldn't be reached.\n\nMost often this is a typo. Open the chain drawer on your transaction page to update the address and resend.\n\nsupport@thesalesprogressor.co.uk`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 16px;font-size:15px">Hi ${originatorName},</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">The chain invite you sent to <strong>${email}</strong> for <strong>${address}</strong> bounced — the email address couldn't be reached.</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">Most often this is a typo. Open the chain drawer on your transaction page to update the address and resend.</p>
<p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Need help? <a href="mailto:support@thesalesprogressor.co.uk" style="color:#8b91a3">support@thesalesprogressor.co.uk</a></p>
<p style="margin:0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</body></html>`,
      from: agencyFrom(link.chain.createdBy?.firmName ?? "Sales Progressor"),
    }).catch(console.error);
  }
}

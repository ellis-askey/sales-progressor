// lib/chain/invite.ts
// Chain invite email sending, decline, and bounce handling.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { extractFirstName } from "@/lib/contacts/displayName";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender, resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { stripAgencyLegalSuffix } from "@/lib/email/from-name";
import { normaliseAddressString } from "@/lib/utils/address";
import { buildChainOverview } from "@/lib/emails/chain-overview";
import { buildBounceNoticeEmailPayload } from "@/lib/email/chainNotifications";
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
  const firstOf = (n: string) => extractFirstName(n);

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

  const stubAddress = normaliseAddressString(link.stubPropertyAddress ?? "your sale");
  const totalLinks = link.chain.links.length;
  const claimedCount = link.chain.links.filter((l) => l.transactionId !== null).length;

  // Redesigned lifecycle template ("See the whole chain"). TSP header, agency
  // sender; the old agency logo band is dropped in favour of the illustrated hero.
  const { subject, html, text } = buildChainOverview({
    saleAddress: stubAddress,
    originatingAddress: originatorAddress,
    chainSize: totalLinks,
    connectedCount: claimedCount,
    chainUrl: claimUrl,
    declineUrl,
  });

  // External agent (unclaimed stub): no recipient user id, so userId stays null
  // and we key the log off the email address only. Send from the originator
  // agency's authenticated address (Reply-To matching), SP fallback when none.
  await sendAgentEmail({ to: link.stubAgentEmail, subject, html, text, from: sender.from, replyTo: sender.replyTo, kind: "chain_invite", meta: { originatorAgency: sender.displayAgency } });
}

// The invite email is now the redesigned buildChainOverview template
// (lib/emails/chain-overview.ts), wired in sendInviteEmail above.

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
    const bounceSender = await resolveAgencySender(link.chain.createdBy?.agencyId ?? null, { fromPlatformAddress: true });
    const payload = buildBounceNoticeEmailPayload({ originatorName, bouncedEmail: email, address });
    await sendEmail({
      to: originatorEmail,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      from: bounceSender.from,
      replyTo: bounceSender.replyTo,
    }).catch(console.error);
  }
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import { resolveEmailTheme, type EmailThemeInput } from "@/lib/email/brand-theme";
import { buildPortalInviteEmail } from "@/lib/email/portal-invite";
import { resolvePortalInviteContent } from "@/lib/agency-email/templates";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { buildGreeting } from "@/lib/portal-copy";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { greetingFirstName } from "@/lib/contacts/displayName";

// Sends a contact their portal-invite email (agency-branded), logs the send as
// an agent-attributed OutboundMessage, and fires the analytics event. Shared by
// POST /api/portal/invite and the Client-portal tab's one-shot invite card so
// the two can never drift. Rate-limiting stays at the route; the invite card
// gates on its own server action. Returns a plain result (no HTTP coupling).
export async function sendPortalInviteByToken(
  token: string,
  opts: { origin: string; actingUserId: string | null; actingUserRole: string | null },
): Promise<{ ok: true; transactionId: string } | { ok: false; error: string; transactionId?: string }> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      roleType: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          serviceType: true,
          agencyId: true,
          progressionBusinessId: true,
          agentUser: { select: { name: true } },
          assignedUser: { select: { name: true } },
          agency: { select: { name: true, emailTheme: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } },
        },
      },
    },
  });

  if (!contact) return { ok: false, error: "Invalid token" };
  if (!contact.email) return { ok: false, error: "Contact has no email" };

  const saleWord = contact.roleType === "vendor" ? "sale" : "purchase";
  const portalUrl = `${opts.origin}/portal/${token}`;
  const agencyName = contact.transaction.agency.name;
  const address = contact.transaction.propertyAddress;

  const { from: fromAddr, replyTo, studioTheme, brandName, logoUrl: resolvedLogoUrl, tileColor: resolvedTileColor } = await resolveAgencySenderForTransaction(contact.transaction.id, { persona: "personal" });

  const greeting = buildGreeting(contact.name);
  const theme = resolveEmailTheme((contact.transaction.agency.emailTheme ?? null) as EmailThemeInput | null);

  const logoBand = agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(contact.transaction.agency.logoPath),
    tileColor: contact.transaction.agency.logoTileColor,
    scale: contact.transaction.agency.logoScale as LogoScale | null,
    align: contact.transaction.agency.logoAlign as LogoAlign | null,
  });
  // Editable copy — the business's own version on an outsourced file, else the
  // agency's, else our default wording.
  const inviteContent = await resolvePortalInviteContent(contact.transaction.agencyId, contact.transaction.progressionBusinessId);
  const invite = buildPortalInviteEmail({ agencyName, address, saleWord, greeting, portalUrl, theme, logoBand, studioTheme, identityName: brandName ?? agencyName, logoUrl: resolvedLogoUrl, tileColor: resolvedTileColor, content: inviteContent });
  try {
    await sendEmail({ to: contact.email, subject: invite.subject, from: fromAddr, replyTo, text: invite.text, html: invite.html });
  } catch (err) {
    // Record the FAILED attempt so the status reads a truthful "Couldn't send"
    // (and the agent knows to retry) instead of the failure vanishing. The
    // link-sent signal ignores "failed" rows, so this never reads as invited.
    await prisma.outboundMessage.create({
      data: {
        transactionId: contact.transaction.id,
        agencyId: contact.transaction.agencyId,
        type: "outbound",
        channel: "email",
        method: "email",
        purpose: "notification",
        status: "failed",
        isAutomated: false,
        subject: "Portal invite",
        content: `Portal invitation to ${greetingFirstName(contact.name)} (${contact.email}) could not be sent.`,
        contactIds: [contact.id],
        recipientName: contact.name,
        recipientEmail: contact.email,
        sentFromEmail: fromAddr,
        createdById: opts.actingUserId,
        createdByRole: opts.actingUserRole,
      },
    }).catch((e) => console.error("[portal-invite] failed to log FAILED invite OutboundMessage", e));
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed", transactionId: contact.transaction.id };
  }

  // Record the send so the contacts card can show a truthful "Invite sent",
  // attributed to whoever pressed the button (their avatar in the activity feed).
  // The hidden subject "Portal invite" is the marker the link-sent signal reads.
  const firstName = greetingFirstName(contact.name);
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.transaction.id,
      agencyId: contact.transaction.agencyId,
      type: "outbound",
      channel: "email",
      method: "email",
      purpose: "notification",
      status: "sent",
      isAutomated: false,
      subject: "Portal invite",
      content: `Portal invitation sent to ${firstName} (${contact.email}).`,
      contactIds: [contact.id],
      recipientName: contact.name,
      recipientEmail: contact.email,
      sentEmailHtml: invite.html,
      sentFromEmail: fromAddr,
      createdById: opts.actingUserId,
      createdByRole: opts.actingUserRole,
      sentAt: new Date(),
    },
  }).catch((err) => console.error("[portal-invite] failed to log invite OutboundMessage", err));

  void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_LINK_SENT, {
    contactId: contact.id,
    roleType: contact.roleType,
  });
  // Return the file id so the calling action can refresh the file (the invite's
  // "sent" activity line is written just above, after createContactAction's own
  // refresh has already run).
  return { ok: true, transactionId: contact.transaction.id };
}

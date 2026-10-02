import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import { resolveEmailTheme, type EmailThemeInput } from "@/lib/email/brand-theme";
import { buildPortalInviteEmail } from "@/lib/email/portal-invite";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { buildGreeting } from "@/lib/portal-copy";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { extractFirstName } from "@/lib/contacts/displayName";

// Sends a contact their portal-invite email (agency-branded), logs the send as
// an agent-attributed OutboundMessage, and fires the analytics event. Shared by
// POST /api/portal/invite and the Client-portal tab's one-shot invite card so
// the two can never drift. Rate-limiting stays at the route; the invite card
// gates on its own server action. Returns a plain result (no HTTP coupling).
export async function sendPortalInviteByToken(
  token: string,
  opts: { origin: string; actingUserId: string | null; actingUserRole: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  const { from: fromAddr, replyTo } = await resolveAgencySenderForTransaction(contact.transaction.id, { persona: "personal" });

  const greeting = buildGreeting(contact.name);
  const theme = resolveEmailTheme((contact.transaction.agency.emailTheme ?? null) as EmailThemeInput | null);

  const logoBand = agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(contact.transaction.agency.logoPath),
    tileColor: contact.transaction.agency.logoTileColor,
    scale: contact.transaction.agency.logoScale as LogoScale | null,
    align: contact.transaction.agency.logoAlign as LogoAlign | null,
  });
  const invite = buildPortalInviteEmail({ agencyName, address, saleWord, greeting, portalUrl, theme, logoBand });
  await sendEmail({ to: contact.email, subject: invite.subject, from: fromAddr, replyTo, text: invite.text, html: invite.html });

  // Record the send so the contacts card can show a truthful "Invite sent",
  // attributed to whoever pressed the button (their avatar in the activity feed).
  // The hidden subject "Portal invite" is the marker the link-sent signal reads.
  const firstName = extractFirstName(contact.name);
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
      content: `Portal invite emailed to ${firstName} (${contact.email}).`,
      contactIds: [contact.id],
      recipientName: contact.name,
      recipientEmail: contact.email,
      createdById: opts.actingUserId,
      createdByRole: opts.actingUserRole,
      sentAt: new Date(),
    },
  }).catch((err) => console.error("[portal-invite] failed to log invite OutboundMessage", err));

  void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_LINK_SENT, {
    contactId: contact.id,
    roleType: contact.roleType,
  });
  return { ok: true };
}

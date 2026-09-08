import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import { resolveEmailTheme, type EmailThemeInput } from "@/lib/email/brand-theme";
import { buildPortalInviteEmail } from "@/lib/email/portal-invite";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { buildGreeting } from "@/lib/portal-copy";
import { checkPortalLimit, rateLimitJson } from "@/lib/ratelimit";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getSession } from "@/lib/session";
import { extractFirstName } from "@/lib/contacts/displayName";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Rate limit by portal token — prevents invite email flooding
  const rl = await checkPortalLimit(token).catch(() => ({ success: true, reset: 0, remaining: 999 }));
  if (!rl.success) {
    return NextResponse.json(rateLimitJson(rl), { status: 429 });
  }

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

  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!contact.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 });

  const saleWord = contact.roleType === "vendor" ? "sale" : "purchase";
  const origin   = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const portalUrl = `${origin}/portal/${token}`;
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

  // Record the send so the contacts card can show a truthful "Invite sent"
  // (resilience audit PR 7). Logged as a normal outbound email BY the acting
  // agent (not a system email) so the file's activity timeline attributes it
  // to whoever pressed the button — their avatar + name at the top of the
  // entry, date top-right, an "Outbound email" channel pill at the foot. The
  // hidden subject "Portal invite" is the marker the link-sent signal reads.
  const session = await getSession();
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
      createdById: session?.user?.id ?? null,
      createdByRole: session?.user?.role ?? null,
      sentAt: new Date(),
    },
  }).catch((err) => console.error("[portal/invite] failed to log invite OutboundMessage", err));

  void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_LINK_SENT, {
    contactId: contact.id,
    roleType:  contact.roleType,
  });
  return NextResponse.json({ ok: true });
}

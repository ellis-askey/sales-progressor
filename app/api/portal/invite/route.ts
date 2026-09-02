import { NextRequest, NextResponse } from "next/server";
import { preheader } from "@/lib/email/preheader";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
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
          agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } },
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

  const { from: fromAddr, replyTo } = await resolveAgencySenderForTransaction(contact.transaction.id);

  const greeting = buildGreeting(contact.name);

  await sendEmail({
    to: contact.email,
    subject: `Your ${saleWord} portal — ${address}`,
    from: fromAddr,
    replyTo,
    text: [
      greeting,
      "",
      `You can now track the progress of your ${saleWord} at ${address} using the link below.`,
      "",
      `Your portal: ${portalUrl}`,
      "",
      "This link is personal to you, so please don't share it with others.",
      "",
      agencyName,
    ].join("\n"),
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">${preheader(`Follow every step of your ${saleWord} in one place, whenever you want to check.`)}${agencyLogoHeaderHtml({ logoUrl: getAgencyLogoUrl(contact.transaction.agency.logoPath), tileColor: contact.transaction.agency.logoTileColor, scale: contact.transaction.agency.logoScale as LogoScale | null, align: contact.transaction.agency.logoAlign as LogoAlign | null })}
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:40px 32px 32px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${agencyName}</p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;line-height:1.2">${address}</h1>
  <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85)">Your ${saleWord} portal is ready</p>
</div>
<div style="padding:32px">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a5162">
    You can now track the progress of your ${saleWord} online. Check in any time to see what's been completed, what's coming next, and get updates from your team.
  </p>
  <p style="margin:0 0 32px">
    <a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(255,107,74,0.35)">
      Open my portal
    </a>
  </p>
  <div style="padding:14px 16px;background:#F8F9FB;border-radius:10px;margin-bottom:24px">
    <p style="margin:0;font-size:12px;color:#8b91a3">
      This link is personal to you — please don't share it with others. You can bookmark it and return any time.
    </p>
  </div>
  <p style="margin:0;font-size:12px;color:#8b91a3">${agencyName}</p>
</div>
</body></html>`,
  });

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

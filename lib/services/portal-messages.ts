import { prisma } from "@/lib/prisma";
import { preheader } from "@/lib/email/preheader";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { pushToContact, pushToUser } from "@/lib/services/push";
import { extractFirstName } from "@/lib/contacts/displayName";
import { buildPortalMessage } from "@/lib/emails/portal-message";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";

export type PortalMessageShape = {
  id: string;
  content: string;
  fromClient: boolean;
  sentByName: string | null;
  createdAt: Date;
};

export type ContactThread = {
  contactId: string;
  contactName: string;
  roleType: string;
  messages: PortalMessageShape[];
  unreadCount: number;
};

export async function getPortalMessages(
  transactionId: string,
  contactId: string
): Promise<PortalMessageShape[]> {
  const msgs = await prisma.portalMessage.findMany({
    where: { transactionId, contactId },
    include: { sentBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return msgs.map((m) => ({
    id: m.id,
    content: m.content,
    fromClient: m.fromClient,
    sentByName: m.fromClient ? null : (m.sentBy?.name ?? null),
    createdAt: m.createdAt,
  }));
}

export async function getAllPortalThreads(transactionId: string): Promise<ContactThread[]> {
  // Phase-2 PR 4 (PortalMessage scoping): scope the contact query so
  // dead-round purchaser threads (fell-through buyers) don't surface on
  // the live tx. Non-purchaser roles pass through — they're file-level
  // by design across all sales.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  const activeBuyerRoundId = tx?.activeBuyerRoundId ?? null;

  const contacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: transactionId,
      OR: [
        { roleType: { not: "purchaser" as const } },
        { buyerRoundId: null },
        ...(activeBuyerRoundId ? [{ buyerRoundId: activeBuyerRoundId }] : []),
      ],
    },
    select: { id: true, name: true, roleType: true },
    orderBy: { createdAt: "asc" },
  });

  const results: ContactThread[] = [];
  for (const c of contacts) {
    const messages = await getPortalMessages(transactionId, c.id);
    if (messages.length > 0) {
      results.push({
        contactId:   c.id,
        contactName: c.name,
        roleType:    c.roleType,
        messages,
        unreadCount: messages.filter((m) => m.fromClient).length,
      });
    }
  }
  return results;
}

export async function sendClientPortalMessage(token: string, content: string): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      roleType: true,
      propertyTransactionId: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          agentUserId: true,
          activeBuyerRoundId: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!contact) throw new Error("Invalid token");

  // Phase 1 commit 4d — purchaser contacts' portal messages are
  // round-scoped at write time; vendor contacts stay file-level.
  // Same attribution rule as Phase 0 backfill for PortalMessage.
  await prisma.portalMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      contactId:     contact.id,
      content,
      fromClient:    true,
      buyerRoundId:  contact.roleType === "purchaser" ? contact.transaction.activeBuyerRoundId : null,
    },
  });
  void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_MESSAGE_SENT_BY_CONTACT, {
    contactId:     contact.id,
    transactionId: contact.propertyTransactionId,
  });

  const tx = contact.transaction;

  // Push notification to the file owner (assignedUser ?? agentUser). Gated on
  // the clientChaseNote toggle — default ON, preserves existing behaviour for
  // anyone who hasn't touched the setting.
  const agentUserId = tx.assignedUser?.id ?? tx.agentUserId;
  if (agentUserId) {
    const prefs = await getNotificationPrefs(agentUserId);
    if (prefs.push.clientChaseNote) {
      const dashUrl = `${process.env.NEXTAUTH_URL ?? ""}/transactions/${tx.id}`;
      pushToUser(agentUserId, {
        title: `${contact.name} replied`,
        body:  content.length > 80 ? content.substring(0, 80) + "…" : content,
        url:   dashUrl,
      }).catch(() => {});
    }
  }

  if (!tx.assignedUser?.email) return;

  const dashUrl = `${process.env.NEXTAUTH_URL ?? ""}/transactions/${tx.id}`;
  const roleLabel = contact.roleType === "purchaser" ? "Buyer" : contact.roleType === "vendor" ? "Seller" : contact.roleType;
  const built = buildPortalMessage({
    senderFirstName: extractFirstName(contact.name),
    senderName: contact.name,
    senderRole: roleLabel,
    addressLine1: tx.propertyAddress,
    timestamp: `Today at ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}`,
    message: content,
    replyUrl: dashUrl,
  });

  await sendAgentEmail({
    to:      tx.assignedUser.email,
    subject: built.subject,
    text:    built.text,
    html:    built.html,
    kind: "portal_message",
    userId: tx.assignedUser.id,
    transactionId: tx.id,
  }).catch(() => {});
}

export async function sendProgressorPortalReply(
  transactionId: string,
  contactId: string,
  content: string,
  progressorId: string,
  progressorName: string,
  // email defaults to true (existing callers unchanged). The "Draft for
  // everyone" flow passes false to post to the portal without emailing, unless
  // the user flips the "Also email" toggle.
  options?: { email?: boolean },
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, propertyTransactionId: transactionId },
    select: {
      id: true,
      name: true,
      email: true,
      roleType: true,
      portalToken: true,
      transaction: { select: { propertyAddress: true, activeBuyerRoundId: true } },
    },
  });
  if (!contact) throw new Error("Contact not found");

  await prisma.portalMessage.create({
    data: {
      transactionId,
      contactId,
      content,
      fromClient: false,
      sentById:   progressorId,
      // Phase 1 commit 4d — same rule as the from-client path above.
      buyerRoundId: contact.roleType === "purchaser" ? contact.transaction.activeBuyerRoundId : null,
    },
  });
  void trackServerEvent(progressorId, ANALYTICS_EVENTS.PORTAL_MESSAGE_SENT_BY_AGENT, {
    contactId,
    transactionId,
  });

  const base    = process.env.NEXTAUTH_URL ?? "";
  const address = contact.transaction.propertyAddress;

  if (contact.portalToken) {
    pushToContact(contactId, {
      title: `Message from ${progressorName}`,
      body:  content.length > 80 ? content.substring(0, 80) + "…" : content,
      url:   `${base}/portal/${contact.portalToken}/updates`,
    }).catch(() => {});
  }

  if (options?.email !== false && contact.email && contact.portalToken) {
    const portalUrl = `${base}/portal/${contact.portalToken}/updates`;
    const sender = await resolveAgencySenderForTransaction(transactionId);
    sendEmail({
      from:    sender.from,
      replyTo: sender.replyTo,
      to:      contact.email,
      subject: `Message from ${progressorName}: ${address}`,
      text: [
        `Hi ${contact.name},`,
        "",
        `${progressorName} sent you a message about ${address}:`,
        "",
        `"${content}"`,
        "",
        `View your portal: ${portalUrl}`,
      ].join("\n"),
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader(`There's a reply waiting for you about ${address}.`)}
<p style="margin:0 0 16px;font-size:15px">Hi ${contact.name},</p>
<div style="margin:0 0 20px;padding:16px 20px;background:#F8F9FB;border-radius:12px;border-left:4px solid #3B82F6">
  <p style="margin:0 0 4px;font-size:12px;color:#8b91a3">${address} · ${progressorName}</p>
  <p style="margin:0;font-size:15px;color:#1a1d29;line-height:1.5">${content}</p>
</div>
<p><a href="${portalUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View your portal</a></p>
</body></html>`,
    }).catch(() => {});
  }
}

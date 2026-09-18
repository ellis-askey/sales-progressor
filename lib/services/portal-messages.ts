import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { buildClientUpdateEmail } from "@/lib/emails/client-update-email";
import { buildGreeting } from "@/lib/portal-copy";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { pushToContact, pushToUser } from "@/lib/services/push";
import { extractFirstName } from "@/lib/contacts/displayName";
import { buildPortalMessage } from "@/lib/emails/portal-message";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { assertLivePortalRound } from "@/lib/portal/round-guard";

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
  // Dead-round guard (P1-4). Without this, a superseded buyer's message would be
  // stamped with the ACTIVE round (see the buyerRoundId stamp below) and surface
  // in the live agent timeline + fire a "{old buyer} replied" push.
  await assertLivePortalRound(token);

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
  // The AI draft this update started as, when it began as a generated client
  // update. Stored on the PortalMessage so the update voice-learning loop can
  // compare draft vs sent. Omitted for two-way replies (nothing to learn from).
  generatedText?: string | null,
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, propertyTransactionId: transactionId },
    select: {
      id: true,
      name: true,
      email: true,
      roleType: true,
      portalToken: true,
      transaction: { select: { propertyAddress: true, activeBuyerRoundId: true, agency: { select: { name: true } } } },
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
      generatedText: generatedText ?? null,
      // Phase 1 commit 4d — same rule as the from-client path above.
      buyerRoundId: contact.roleType === "purchaser" ? contact.transaction.activeBuyerRoundId : null,
    },
  });
  void trackServerEvent(progressorId, ANALYTICS_EVENTS.PORTAL_MESSAGE_SENT_BY_AGENT, {
    contactId,
    transactionId,
  });

  const base      = process.env.NEXTAUTH_URL ?? "";
  const address   = contact.transaction.propertyAddress;
  const portalUrl = `${base}/portal/${contact.portalToken}/updates`;

  // The portal feed entry above is the record; every client always gets it.
  // On top, exactly ONE alert: a phone notification if it actually lands on
  // one of their devices, otherwise an email. Never both. A subscription that
  // has gone stale (uninstalled / permission revoked) delivers nothing, so we
  // fall back to email — this is "working notifications right now", not
  // "installed once".
  let alerted = false;
  if (contact.portalToken) {
    const { delivered } = await pushToContact(contactId, {
      title: `Message from ${progressorName}`,
      body:  content.length > 80 ? content.substring(0, 80) + "…" : content,
      url:   portalUrl,
    });
    alerted = delivered > 0;
  }

  if (!alerted && contact.email && contact.portalToken) {
    const sender = await resolveAgencySenderForTransaction(transactionId, { persona: "personal" });
    const theme = sender.theme ?? resolveEmailTheme(null);
    const saleWord = contact.roleType === "vendor" ? "sale" : "purchase";
    // Same branded template as the comms-panel update, so every written client
    // update looks the same and carries the agency's colours.
    const email = buildClientUpdateEmail({
      agencyName: contact.transaction.agency?.name ?? "",
      address,
      saleWord,
      greeting: buildGreeting(contact.name),
      content,
      portalUrl,
      theme,
    });
    sendEmail({
      from:    sender.from,
      replyTo: sender.replyTo,
      to:      contact.email,
      subject: email.subject,
      text:    email.text,
      html:    email.html,
    }).catch(() => {});
  }
}

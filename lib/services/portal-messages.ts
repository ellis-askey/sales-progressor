import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { pushToContact } from "@/lib/services/push";

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
  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId },
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
      propertyTransactionId: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!contact) throw new Error("Invalid token");

  await prisma.portalMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      contactId:     contact.id,
      content,
      fromClient:    true,
    },
  });

  const tx = contact.transaction;
  if (!tx.assignedUser?.email) return;

  const dashUrl = `${process.env.NEXTAUTH_URL ?? ""}/transactions/${tx.id}`;
  const first   = tx.assignedUser.name.split(" ")[0];

  await sendEmail({
    to:      tx.assignedUser.email,
    subject: `Message from ${contact.name} — ${tx.propertyAddress}`,
    text: [
      `Hi ${first},`,
      "",
      `${contact.name} sent you a message about ${tx.propertyAddress}:`,
      "",
      `"${content}"`,
      "",
      `Reply on their file: ${dashUrl}`,
    ].join("\n"),
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 16px;font-size:15px">Hi ${first},</p>
<div style="margin:0 0 20px;padding:16px 20px;background:#F8F9FB;border-radius:12px;border-left:4px solid #FF6B4A">
  <p style="margin:0 0 4px;font-size:12px;color:#8b91a3">${tx.propertyAddress} · ${contact.name}</p>
  <p style="margin:0;font-size:15px;color:#1a1d29;line-height:1.5">${content}</p>
</div>
<p><a href="${dashUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">Reply on their file</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">Sales Progressor</p>
</body></html>`,
  }).catch(() => {});
}

export async function sendProgressorPortalReply(
  transactionId: string,
  contactId: string,
  content: string,
  progressorId: string,
  progressorName: string
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, propertyTransactionId: transactionId },
    select: {
      id: true,
      name: true,
      email: true,
      portalToken: true,
      transaction: { select: { propertyAddress: true } },
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
    },
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

  if (contact.email && contact.portalToken) {
    const portalUrl = `${base}/portal/${contact.portalToken}/updates`;
    sendEmail({
      to:      contact.email,
      subject: `Message from ${progressorName} — ${address}`,
      text: [
        `Hi ${contact.name},`,
        "",
        `${progressorName} sent you a message about ${address}:`,
        "",
        `"${content}"`,
        "",
        `View your portal: ${portalUrl}`,
      ].join("\n"),
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 16px;font-size:15px">Hi ${contact.name},</p>
<div style="margin:0 0 20px;padding:16px 20px;background:#F8F9FB;border-radius:12px;border-left:4px solid #3B82F6">
  <p style="margin:0 0 4px;font-size:12px;color:#8b91a3">${address} · ${progressorName}</p>
  <p style="margin:0;font-size:15px;color:#1a1d29;line-height:1.5">${content}</p>
</div>
<p><a href="${portalUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View your portal</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">Sales Progressor</p>
</body></html>`,
    }).catch(() => {});
  }
}

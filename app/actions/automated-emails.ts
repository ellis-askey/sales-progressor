"use server";

// Server actions for the Automated-emails detail drawer.
//
// Scope is always re-derived from the session here (never trusted from the
// client): every action verifies the target transaction is inside the caller's
// access scope before returning anything about it.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";

export type FileEmailActivityItem = {
  id: string;
  kind: "Chase" | "Notification";
  label: string;        // e.g. "Chase sent" / "Notification sent"
  at: Date;
  deliveryStatus: string;
};

// Recent automated-email activity for one transaction, for the drawer's
// "Activity on this transaction" section. Scoped: returns [] if the caller
// can't see the file.
export async function getFileEmailTimeline(transactionId: string): Promise<FileEmailActivityItem[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];

  const [queueRows, messageRows] = await Promise.all([
    prisma.outboundEmailQueue.findMany({
      where: { sentAt: { not: null }, recipientContact: { propertyTransactionId: transactionId } },
      select: { id: true, emailType: true, sentAt: true, deliveredAt: true, bouncedAt: true, blockedAt: true, errorAt: true },
      orderBy: { sentAt: "desc" },
      take: 8,
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId, channel: "email", purpose: "chase", isAutomated: true, createdByRole: "director", sentAt: { not: null } },
      select: { id: true, sentAt: true, status: true, deliveredAt: true, failedAt: true },
      orderBy: { sentAt: "desc" },
      take: 8,
    }),
  ]);

  const items: FileEmailActivityItem[] = [];
  for (const r of queueRows) {
    const kind = r.emailType === "CLIENT_CHASE" ? "Chase" : "Notification";
    let status = "Sent";
    if (r.errorAt) status = "Errored";
    else if (r.bouncedAt) status = "Bounced";
    else if (r.blockedAt) status = "Blocked";
    else if (r.deliveredAt) status = "Delivered";
    items.push({ id: r.id, kind, label: `${kind} sent`, at: r.sentAt as Date, deliveryStatus: status });
  }
  for (const m of messageRows) {
    let status = "Sent";
    if (m.status === "failed" || m.failedAt) status = "Failed";
    else if (m.status === "bounced") status = "Bounced";
    else if (m.status === "delivered" || m.deliveredAt) status = "Delivered";
    items.push({ id: m.id, kind: "Chase", label: "Chase sent", at: m.sentAt as Date, deliveryStatus: status });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 6);
}

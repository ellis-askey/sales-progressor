import { commandDb } from "@/lib/command/prisma";

// Command Centre → Follow-up usage. How many clients opened the "email your
// conveyancer" follow-up (tapped Open-in-email) vs actually sent one (a CC'd
// copy filed to the file via the inbox sync). The gap = opened but never sent.

export type FollowupUsageRow = {
  name: string;
  address: string;
  role: "Buyer" | "Seller";
  opens: number;
  lastOpened: Date | null;
  behind: number; // opens while the step was running behind
  sent: boolean; // a filed email from them to their solicitor exists since their first open
  lastSent: Date | null;
};

export type FollowupUsage = {
  totalOpens: number;
  openers: number;
  sentCount: number;
  rows: FollowupUsageRow[];
};

export async function getFollowupUsage(): Promise<FollowupUsage> {
  const taps = await commandDb.followupTap.findMany({
    orderBy: { tappedAt: "desc" },
    take: 3000,
    select: { contactId: true, transactionId: true, state: true, tappedAt: true },
  });

  const byContact = new Map<string, { contactId: string | null; transactionId: string; taps: { state: string; at: Date }[] }>();
  for (const t of taps) {
    const key = t.contactId ?? `tx:${t.transactionId}`;
    const g = byContact.get(key) ?? { contactId: t.contactId, transactionId: t.transactionId, taps: [] };
    g.taps.push({ state: t.state, at: t.tappedAt });
    byContact.set(key, g);
  }

  const rows: FollowupUsageRow[] = [];
  for (const g of byContact.values()) {
    const contact = g.contactId
      ? await commandDb.contact.findUnique({
          where: { id: g.contactId },
          select: { name: true, email: true, roleType: true, transaction: { select: { propertyAddress: true } } },
        })
      : null;

    const times = g.taps.map((t) => t.at.getTime());
    const earliest = new Date(Math.min(...times));
    let lastSent: Date | null = null;
    if (contact?.email) {
      const sent = await commandDb.outboundMessage.findFirst({
        where: {
          transactionId: g.transactionId,
          type: "inbound",
          recipientEmail: { equals: contact.email, mode: "insensitive" },
          sentAt: { gte: earliest },
        },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      });
      lastSent = sent?.sentAt ?? null;
    }

    rows.push({
      name: contact?.name ?? "Unknown",
      address: contact?.transaction.propertyAddress ?? "—",
      role: contact?.roleType === "vendor" ? "Seller" : "Buyer",
      opens: g.taps.length,
      lastOpened: new Date(Math.max(...times)),
      behind: g.taps.filter((t) => t.state === "behind").length,
      sent: lastSent != null,
      lastSent,
    });
  }

  rows.sort((a, b) => (b.lastOpened?.getTime() ?? 0) - (a.lastOpened?.getTime() ?? 0));

  return {
    totalOpens: taps.length,
    openers: byContact.size,
    sentCount: rows.filter((r) => r.sent).length,
    rows,
  };
}

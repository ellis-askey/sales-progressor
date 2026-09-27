// Previous (fallen-through) sales for a file — powers the sidebar "Previous
// sales" card (critique #12). Each archived buyer round with the buyer(s) who
// were on it, so the card can show their avatar(s) + names and open the
// existing ArchivedRoundDrawer. Replaces the tiny hero round-chip as the home
// for previous-buyer info.

import { prisma } from "@/lib/prisma";

export type PreviousSaleBuyer = { name: string; image: string | null };

export type PreviousSale = {
  roundId: string;
  roundNumber: number;
  fellThroughAt: string | null; // ISO; null when the round was never archived
  reason: string | null;
  buyers: PreviousSaleBuyer[];
};

export async function getPreviousSales(transactionId: string): Promise<PreviousSale[]> {
  const rounds = await prisma.buyerRound.findMany({
    where: { transactionId, status: "withdrawn" },
    orderBy: { roundNumber: "desc" },
    select: { id: true, roundNumber: true, archivedAt: true, fallThroughReason: true },
  });
  if (rounds.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: transactionId,
      roleType: "purchaser",
      buyerRoundId: { in: rounds.map((r) => r.id) },
    },
    select: { name: true, image: true, buyerRoundId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byRound = new Map<string, PreviousSaleBuyer[]>();
  for (const c of contacts) {
    if (!c.buyerRoundId) continue;
    const list = byRound.get(c.buyerRoundId) ?? [];
    list.push({ name: c.name, image: c.image ?? null });
    byRound.set(c.buyerRoundId, list);
  }

  return rounds.map((r) => ({
    roundId: r.id,
    roundNumber: r.roundNumber,
    fellThroughAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    reason: r.fallThroughReason ?? null,
    buyers: byRound.get(r.id) ?? [],
  }));
}

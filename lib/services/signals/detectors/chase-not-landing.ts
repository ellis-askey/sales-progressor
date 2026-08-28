// Detector: chase_not_landing
// Live files where chases went out but nothing came back — no response via the
// link and not ticked as replied-by-email — after GRACE_DAYS. One signal per
// file, carrying how many chases are unanswered.

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const GRACE_DAYS = 7;

export const chaseNotLanding: Detector = async (window) => {
  const now = window.current.end;
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 86_400_000);

  const grouped = await prisma.chaseSend.groupBy({
    by: ["transactionId"],
    where: {
      sentAt: { lt: cutoff },
      respondedAt: null,
      repliedByEmailAt: null,
      transaction: {
        status: "active",
        isDemo: false,
        isMigrated: false,
        agency: { isInternal: false },
      },
    },
    _count: { _all: true },
    _max: { sentAt: true },
  });

  if (grouped.length === 0) return [];

  const txIds = grouped.map((g) => g.transactionId);
  const txs = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds } },
    select: { id: true, propertyAddress: true, agency: { select: { name: true } } },
  });
  const txById = new Map(txs.map((t) => [t.id, t]));

  const signals: SignalResult[] = [];
  for (const g of grouped) {
    const tx = txById.get(g.transactionId);
    if (!tx) continue;
    const unanswered = g._count._all;
    const lastSent = g._max.sentAt;
    const daysSinceLast = lastSent ? Math.floor((now.getTime() - lastSent.getTime()) / 86_400_000) : GRACE_DAYS;

    signals.push({
      detectorName: "chase_not_landing",
      dedupeKey: `chase_not_landing:${g.transactionId}`,
      payload: {
        transactionId: g.transactionId,
        address: tx.propertyAddress,
        agencyName: tx.agency?.name ?? null,
        unansweredChases: unanswered,
        daysSinceLastChase: daysSinceLast,
      },
      confidence: Math.min(0.9, 0.5 + unanswered * 0.1),
      severity: "leak",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  return signals;
};

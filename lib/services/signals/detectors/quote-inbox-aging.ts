// Detector: quote_inbox_aging
// Quote requests still sitting as "pending" in the inbox past AGING_DAYS. One
// summary signal (count + the oldest) so the inbox doesn't spam a row per quote.

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const AGING_DAYS = 5;

export const quoteInboxAging: Detector = async (window) => {
  const now = window.current.end;
  const cutoff = new Date(now.getTime() - AGING_DAYS * 86_400_000);

  const aging = await prisma.quoteRequest.findMany({
    where: {
      status: "pending",
      submittedAt: { lt: cutoff },
      transaction: { isDemo: false, agency: { isInternal: false } },
    },
    orderBy: { submittedAt: "asc" },
    select: { id: true, submittedAt: true },
    take: 500,
  });

  if (aging.length === 0) return [];

  const oldest = aging[0].submittedAt;
  const oldestDaysWaiting = Math.floor((now.getTime() - oldest.getTime()) / 86_400_000);

  return [
    {
      detectorName: "quote_inbox_aging",
      dedupeKey: "quote_inbox_aging:pending",
      payload: {
        pendingCount: aging.length,
        oldestDaysWaiting,
        agingThresholdDays: AGING_DAYS,
      },
      confidence: 0.8,
      severity: "leak",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    },
  ];
};

// Detector: solicitor_confirm_pending
// Solicitor confirmations we've escalated — chased to the cap with no response.
// These are the genuinely stuck steps on live files (not routine open chases).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";
import { solicitorStepLabel } from "@/lib/solicitor-confirm/codes";

export const solicitorConfirmPending: Detector = async (window) => {
  const now = window.current.end;

  const escalated = await prisma.solicitorChaseState.findMany({
    where: {
      status: "escalated",
      resolvedAt: null,
      transaction: {
        status: "active",
        isDemo: false,
        isMigrated: false,
        agency: { isInternal: false },
      },
    },
    select: {
      id: true,
      transactionId: true,
      side: true,
      milestoneCode: true,
      chaseCount: true,
      lastChasedAt: true,
      transaction: { select: { propertyAddress: true, agency: { select: { name: true } } } },
    },
    take: 100,
  });

  return escalated.map((s) => {
    const daysSinceChase = s.lastChasedAt
      ? Math.floor((now.getTime() - s.lastChasedAt.getTime()) / 86_400_000)
      : null;
    return {
      detectorName: "solicitor_confirm_pending",
      dedupeKey: `solicitor_confirm_pending:${s.id}`,
      payload: {
        transactionId: s.transactionId,
        address: s.transaction.propertyAddress,
        agencyName: s.transaction.agency?.name ?? null,
        side: s.side === "vendor" ? "seller side" : "buyer side",
        step: solicitorStepLabel(s.milestoneCode, s.milestoneCode),
        chaseCount: s.chaseCount,
        daysSinceLastChase: daysSinceChase,
      },
      confidence: 1.0,
      severity: "leak",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    } satisfies SignalResult;
  });
};

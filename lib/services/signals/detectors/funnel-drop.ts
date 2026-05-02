// Detector: funnel_drop
// Monitors the core activation funnel: signup → first transaction → first solicitor assigned.
// Fires when drop-off rate at any step increases by more than 10pp week-over-week.
// Minimum N=30 entries to the step required (ADMIN_07 §5.3).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_STEP_ENTRIES = 30;
const MIN_DELTA_PP = 10; // percentage points

type FunnelRates = {
  signups: number;
  activationRate: number;     // agencies with ≥1 transaction / agencies created
  solicitorRate: number;      // transactions with solicitor / all transactions
};

async function getFunnelRates(start: Date, end: Date): Promise<FunnelRates> {
  const [signups, activatedAgencies, totalTransactions, transactionsWithSolicitor] =
    await Promise.all([
      // Signups: agencies created in window
      prisma.agency.count({ where: { createdAt: { gte: start, lt: end } } }),

      // Activated: agencies created in window that also created a transaction (ever)
      prisma.agency.count({
        where: {
          createdAt: { gte: start, lt: end },
          transactions: { some: {} },
        },
      }),

      // Transactions created in window
      prisma.propertyTransaction.count({
        where: { createdAt: { gte: start, lt: end } },
      }),

      // Transactions with solicitor: at least one solicitor assigned
      prisma.propertyTransaction.count({
        where: {
          createdAt: { gte: start, lt: end },
          OR: [
            { vendorSolicitorFirmId: { not: null } },
            { purchaserSolicitorFirmId: { not: null } },
          ],
        },
      }),
    ]);

  return {
    signups,
    activationRate: signups > 0 ? activatedAgencies / signups : 0,
    solicitorRate: totalTransactions > 0 ? transactionsWithSolicitor / totalTransactions : 0,
  };
}

export const funnelDrop: Detector = async (window) => {
  const [current, previous] = await Promise.all([
    getFunnelRates(window.current.start, window.current.end),
    getFunnelRates(window.previous.start, window.previous.end),
  ]);

  if (previous.signups === 0) return []; // no data yet

  const signals: SignalResult[] = [];

  // Step 1: signup → first transaction (activation)
  if (previous.signups >= MIN_STEP_ENTRIES) {
    const dropPP = (previous.activationRate - current.activationRate) * 100;
    if (dropPP >= MIN_DELTA_PP) {
      const confidence = Math.min(
        0.4 + (previous.signups / 100) * 0.3 + (dropPP / 50) * 0.3,
        0.92
      );
      signals.push({
        detectorName: "funnel_drop",
        dedupeKey: "funnel_drop:signup_to_activation",
        payload: {
          step: "signup_to_activation",
          stepLabel: "Signup → first transaction",
          currentRate: Math.round(current.activationRate * 100),
          previousRate: Math.round(previous.activationRate * 100),
          dropPP: Math.round(dropPP),
          nSignups: previous.signups,
        },
        confidence,
        severity: confidence >= 0.6 ? "leak" : "info",
        windowStart: window.current.start,
        windowEnd: window.current.end,
      });
    }
  }

  // Step 2: transaction → solicitor assigned
  const prevTxCount = Math.round(previous.signups * previous.activationRate);
  if (prevTxCount >= MIN_STEP_ENTRIES) {
    const dropPP = (previous.solicitorRate - current.solicitorRate) * 100;
    if (dropPP >= MIN_DELTA_PP) {
      const confidence = Math.min(
        0.4 + (prevTxCount / 100) * 0.3 + (dropPP / 50) * 0.3,
        0.92
      );
      signals.push({
        detectorName: "funnel_drop",
        dedupeKey: "funnel_drop:transaction_to_solicitor",
        payload: {
          step: "transaction_to_solicitor",
          stepLabel: "Transaction → solicitor assigned",
          currentRate: Math.round(current.solicitorRate * 100),
          previousRate: Math.round(previous.solicitorRate * 100),
          dropPP: Math.round(dropPP),
          nTransactions: prevTxCount,
        },
        confidence,
        severity: confidence >= 0.6 ? "leak" : "info",
        windowStart: window.current.start,
        windowEnd: window.current.end,
      });
    }
  }

  return signals;
};

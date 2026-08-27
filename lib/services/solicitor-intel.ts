// lib/services/solicitor-intel.ts
// Computes performance intelligence for a solicitor firm from historical transaction data.

import { prisma } from "@/lib/prisma";

export type SolicitorIntel = {
  firmId: string;
  firmName: string;
  totalFiles: number;
  completedFiles: number;
  medianWeeksToExchange: number | null;
  medianDaysSearches: number | null; // PM9 → PM10
  rating: "fast" | "average" | "slow" | "unknown";
  warning: string | null;
};

const BASELINE_EXCHANGE_WEEKS = 12;
const BASELINE_SEARCH_DAYS = 21;

// The middle value of a sorted list — the "typical" file, unskewed by the odd
// disaster (a collapsed chain, an awkward leasehold) that an average would let
// distort the whole figure. Even-length lists take the mean of the two middle
// values. Returns null for an empty list.
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function getSolicitorIntel(firmId: string): Promise<SolicitorIntel | null> {
  const firm = await prisma.solicitorFirm.findUnique({
    where: { id: firmId },
    select: {
      id: true,
      name: true,
      // isMigrated:false on both sides — solicitor performance medians
      // (medianWeeksToExchange, medianDaysSearches) would be polluted by backdated
      // migration files whose timestamps were estimates, not real signals.
      // PHASE 1 4d (a)-CLASS — per-solicitor-firm performance averages
      // for the Command Centre solicitor-intel page. Cross-tx Prisma
      // include limitation: nested where can't reference parent row's
      // activeBuyerRoundId. Display only; no action surface — agents
      // see solicitor avg weeks-to-exchange / avg-days-search-turnaround
      // but no comms / chases / billing fire from this read. Phase 2
      // ticket: when relisted files exist, accept that an archived
      // round's VM12/PM16/PM9/PM10 timestamps could pollute the firm's
      // averages and decide whether to restructure or carry the
      // distortion. Pre-relist parity: byte-identical.
      vendorForTransactions: {
        where: { isMigrated: false },
        select: {
          id: true,
          createdAt: true,
          status: true,
          milestoneCompletions: {
            where: { state: "complete" },
            select: {
              completedAt: true,
              milestoneDefinition: { select: { code: true } },
            },
          },
        },
      },
      purchaserForTransactions: {
        where: { isMigrated: false },
        select: {
          id: true,
          createdAt: true,
          status: true,
          milestoneCompletions: {
            where: { state: "complete" },
            select: {
              completedAt: true,
              milestoneDefinition: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!firm) return null;

  const allTx = [...firm.vendorForTransactions, ...firm.purchaserForTransactions];
  const totalFiles = allTx.length;

  // Compute avg weeks to exchange for completed files
  const exchangeWeeksList: number[] = [];
  const searchDaysList: number[] = [];

  for (const tx of allTx) {
    const completions = tx.milestoneCompletions;
    const byCode = new Map(completions.map((c) => [c.milestoneDefinition.code, c.completedAt]));

    // Weeks to exchange: file created → actual exchange (VM19 / PM26).
    // (Previously keyed on VM12/PM16 — enquiry-reply steps, now retired.)
    const exchangeDate = byCode.get("VM19") ?? byCode.get("PM26");
    if (exchangeDate) {
      const weeks = (new Date(exchangeDate).getTime() - new Date(tx.createdAt).getTime()) / (7 * 86400000);
      if (weeks > 0 && weeks < 104) exchangeWeeksList.push(weeks);
    }

    // Search turnaround: PM9 → PM10
    const searchOrdered = byCode.get("PM9");
    const searchReceived = byCode.get("PM10");
    if (searchOrdered && searchReceived) {
      const days = (new Date(searchReceived).getTime() - new Date(searchOrdered).getTime()) / 86400000;
      if (days > 0 && days < 120) searchDaysList.push(days);
    }
  }

  const completedFiles = exchangeWeeksList.length;
  const medianWeeksRaw = median(exchangeWeeksList);
  const medianWeeksToExchange = medianWeeksRaw !== null ? Math.round(medianWeeksRaw * 10) / 10 : null;

  const medianDaysRaw = median(searchDaysList);
  const medianDaysSearches = medianDaysRaw !== null ? Math.round(medianDaysRaw) : null;

  // Rating
  let rating: SolicitorIntel["rating"] = "unknown";
  let warning: string | null = null;

  if (medianWeeksToExchange !== null && completedFiles >= 2) {
    if (medianWeeksToExchange <= BASELINE_EXCHANGE_WEEKS * 0.85) rating = "fast";
    else if (medianWeeksToExchange <= BASELINE_EXCHANGE_WEEKS * 1.2) rating = "average";
    else {
      rating = "slow";
      warning = `This firm typically takes ${medianWeeksToExchange} weeks to exchange across ${completedFiles} files, above the ${BASELINE_EXCHANGE_WEEKS}-week target. Chase early.`;
    }
  }

  if (!warning && medianDaysSearches !== null && medianDaysSearches > BASELINE_SEARCH_DAYS) {
    warning = `This firm typically takes ${medianDaysSearches} days for search turnaround, above the usual ${BASELINE_SEARCH_DAYS} days.`;
  }

  return {
    firmId: firm.id,
    firmName: firm.name,
    totalFiles,
    completedFiles,
    medianWeeksToExchange,
    medianDaysSearches,
    rating,
    warning,
  };
}

export async function getAllSolicitorIntel(agencyId: string): Promise<SolicitorIntel[]> {
  const firms = await prisma.solicitorFirm.findMany({
    select: { id: true },
  });

  const results = await Promise.all(firms.map((f) => getSolicitorIntel(f.id)));
  return results
    .filter((r): r is SolicitorIntel => r !== null)
    .sort((a, b) => {
      const order = { slow: 0, unknown: 1, average: 2, fast: 3 };
      return order[a.rating] - order[b.rating];
    });
}

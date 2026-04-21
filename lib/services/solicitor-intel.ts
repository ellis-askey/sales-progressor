// lib/services/solicitor-intel.ts
// Computes performance intelligence for a solicitor firm from historical transaction data.

import { prisma } from "@/lib/prisma";

export type SolicitorIntel = {
  firmId: string;
  firmName: string;
  totalFiles: number;
  completedFiles: number;
  avgWeeksToExchange: number | null;
  avgDaysSearches: number | null; // PM9 → PM10
  rating: "fast" | "average" | "slow" | "unknown";
  warning: string | null;
};

const BASELINE_EXCHANGE_WEEKS = 12;
const BASELINE_SEARCH_DAYS = 21;

export async function getSolicitorIntel(firmId: string): Promise<SolicitorIntel | null> {
  const firm = await prisma.solicitorFirm.findUnique({
    where: { id: firmId },
    select: {
      id: true,
      name: true,
      vendorForTransactions: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          milestoneCompletions: {
            where: { isActive: true, isNotRequired: false },
            select: {
              completedAt: true,
              milestoneDefinition: { select: { code: true } },
            },
          },
        },
      },
      purchaserForTransactions: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          milestoneCompletions: {
            where: { isActive: true, isNotRequired: false },
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

    // Weeks to exchange: file created → VM12 or PM16 completion
    const exchangeDate = byCode.get("VM12") ?? byCode.get("PM16");
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
  const avgWeeksToExchange = completedFiles > 0
    ? Math.round((exchangeWeeksList.reduce((s, v) => s + v, 0) / completedFiles) * 10) / 10
    : null;

  const avgDaysSearches = searchDaysList.length > 0
    ? Math.round(searchDaysList.reduce((s, v) => s + v, 0) / searchDaysList.length)
    : null;

  // Rating
  let rating: SolicitorIntel["rating"] = "unknown";
  let warning: string | null = null;

  if (avgWeeksToExchange !== null && completedFiles >= 2) {
    if (avgWeeksToExchange <= BASELINE_EXCHANGE_WEEKS * 0.85) rating = "fast";
    else if (avgWeeksToExchange <= BASELINE_EXCHANGE_WEEKS * 1.2) rating = "average";
    else {
      rating = "slow";
      warning = `This firm has averaged ${avgWeeksToExchange} weeks to exchange across ${completedFiles} files — above the ${BASELINE_EXCHANGE_WEEKS}-week target. Chase early.`;
    }
  }

  if (!warning && avgDaysSearches !== null && avgDaysSearches > BASELINE_SEARCH_DAYS) {
    warning = `This firm has averaged ${avgDaysSearches} days for search turnaround — above the typical ${BASELINE_SEARCH_DAYS} days.`;
  }

  return {
    firmId: firm.id,
    firmName: firm.name,
    totalFiles,
    completedFiles,
    avgWeeksToExchange,
    avgDaysSearches,
    rating,
    warning,
  };
}

export async function getAllSolicitorIntel(agencyId: string): Promise<SolicitorIntel[]> {
  const firms = await prisma.solicitorFirm.findMany({
    where: { agencyId },
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

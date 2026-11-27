// lib/command/tsp-outsourced.ts
//
// The data layer for the TSP Outsourced hub (/command/tsp-outsourced) — the
// single home for TSP's OWN outsourced progression book. "TSP outsourced" is
// the clean two-field slice:
//
//     serviceType = "outsourced"  AND  progressionBusinessId = null
//
// The progressionBusinessId=null guard is what tells TSP's own book apart from
// external progression businesses (whose files are ALSO serviceType
// "outsourced"). The sidebar's old "PM" scope couldn't make that distinction —
// this hub is the correct pattern, mirroring the overview POPULATIONS block.
//
// Reads live transactions (not the DailyMetric rollup, which has no business
// dimension and so cannot separate TSP from external — see
// docs/active/tsp-outsourced-hub/00-plan.md, decision 3). TSP progression is
// winding down (docs/active/outsourced-sunset/), so the book is small and a
// live read per page view is cheap.

import { prisma } from "@/lib/prisma";
import { computeFee } from "@/lib/billing/fee";

// Longest-outstanding first; cap the rendered book. bookTotal carries the true
// count so the page can say "showing N of M".
const BOOK_LIMIT = 60;

export interface TspBookRow {
  id: string;
  address: string;
  agencyName: string | null;
  modeProfile: string;
  progressorName: string | null;
  daysOutsourced: number;
  expectedExchangeDate: Date | null;
  overdue: boolean;
  lastMilestoneAt: Date | null;
  daysSilent: number;
}

export interface TspSupplyingAgency {
  id: string;
  name: string;
  modeProfile: string;
  count: number;
}

export interface TspProgressorLoad {
  id: string | null; // null = unassigned
  name: string;
  count: number;
}

export interface TspOutsourcedHub {
  counts: {
    active: number;
    overdue: number;
    unassigned: number;
    exchangedNotCompleted: number;
    completed: number;
    supplyingAgencies: number;
  };
  revenue: {
    /** Estimated fee if every live file exchanges at today's price — not banked. */
    pipelinePence: number;
    /** Billed outsourced_fee invoice lines on TSP files (frozen amounts). */
    bankedPence: number;
  };
  book: TspBookRow[];
  bookTotal: number;
  supplying: TspSupplyingAgency[];
  progressors: TspProgressorLoad[];
}

// The clean TSP-outsourced slice, with the same demo/internal/migrated
// exclusions every other CC metric uses so the figures line up.
const TSP_OUTSOURCED = {
  serviceType: "outsourced" as const,
  progressionBusinessId: null,
  isDemo: false,
  isMigrated: false,
  agency: { isInternal: false },
};

const DAY_MS = 86_400_000;
function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY_MS);
}

export async function getTspOutsourcedHub(): Promise<TspOutsourcedHub> {
  const now = new Date();

  const [activeFiles, exchangedNotCompleted, completed, banked] = await Promise.all([
    // Every LIVE outsourced TSP file (not yet exchanged). One query feeds the
    // book, the counts, the supplying-agency and progressor breakdowns, and the
    // pipeline estimate — the book is small, so a single read with the fee
    // fields attached is cheaper than fanning out groupBy queries.
    prisma.propertyTransaction.findMany({
      where: { ...TSP_OUTSOURCED, status: { in: ["active", "on_hold"] }, exchangedAt: null },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        createdAt: true,
        outsourcedAt: true,
        expectedExchangeDate: true,
        purchasePrice: true, // pence
        pricingVersion: true,
        assignedUser: { select: { id: true, name: true } },
        agency: {
          select: {
            id: true,
            name: true,
            modeProfile: true,
            feeTier: true,
            legacyOutsourcedFeePence: true,
            vatRegisteredAt: true,
            vatRateBps: true,
          },
        },
        milestoneCompletions: {
          where: { state: "complete" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),
    // Exchanged but not yet completed — the "in the final stretch" tile.
    prisma.propertyTransaction.count({
      where: { ...TSP_OUTSOURCED, exchangedAt: { not: null }, status: { not: "completed" } },
    }),
    // Completed to date — the book's lifetime output.
    prisma.propertyTransaction.count({
      where: { ...TSP_OUTSOURCED, status: "completed" },
    }),
    // Banked: frozen outsourced_fee invoice lines on TSP files (null business).
    prisma.invoiceLine.aggregate({
      where: { kind: "outsourced_fee", transaction: { progressionBusinessId: null, isDemo: false } },
      _sum: { totalPence: true },
    }),
  ]);

  // ── Derive everything else from the single active-file read ───────────────
  let overdue = 0;
  let unassigned = 0;
  let pipelinePence = 0;
  const supplyMap = new Map<string, TspSupplyingAgency>();
  const loadMap = new Map<string, TspProgressorLoad>();

  for (const f of activeFiles) {
    const expectedOverdue = !!f.expectedExchangeDate && f.expectedExchangeDate < now;
    if (expectedOverdue) overdue += 1;
    if (!f.assignedUser) unassigned += 1;

    // Pipeline estimate — what we'd charge if this file exchanged at today's
    // price. Mirrors lib/command/revenue.ts: purchasePrice is in pence and is
    // the live stand-in for priceAtExchange on a not-yet-exchanged file.
    pipelinePence += computeFee(
      "outsourced",
      f.purchasePrice,
      { vatRegisteredAt: f.agency.vatRegisteredAt, vatRateBps: f.agency.vatRateBps },
      { feeTier: f.agency.feeTier, legacyOutsourcedFeePence: f.agency.legacyOutsourcedFeePence },
      f.pricingVersion,
    ).totalPence;

    // Supplying agencies.
    const a = supplyMap.get(f.agency.id);
    if (a) a.count += 1;
    else supplyMap.set(f.agency.id, { id: f.agency.id, name: f.agency.name, modeProfile: f.agency.modeProfile, count: 1 });

    // Progressor workload (unassigned bucketed under the sentinel key).
    const key = f.assignedUser?.id ?? "__unassigned__";
    const l = loadMap.get(key);
    if (l) l.count += 1;
    else loadMap.set(key, { id: f.assignedUser?.id ?? null, name: f.assignedUser?.name ?? "Unassigned", count: 1 });
  }

  // Book rows, longest-outstanding first (outsourcedAt, falling back to
  // createdAt for files born outsourced before that field existed).
  const anchor = (f: (typeof activeFiles)[number]) => f.outsourcedAt ?? f.createdAt;
  const book: TspBookRow[] = [...activeFiles]
    .sort((x, y) => anchor(x).getTime() - anchor(y).getTime())
    .slice(0, BOOK_LIMIT)
    .map((f) => {
      const lastMilestoneAt = f.milestoneCompletions[0]?.completedAt ?? null;
      return {
        id: f.id,
        address: f.propertyAddress,
        agencyName: f.agency.name,
        modeProfile: f.agency.modeProfile,
        progressorName: f.assignedUser?.name ?? null,
        daysOutsourced: daysSince(anchor(f)),
        expectedExchangeDate: f.expectedExchangeDate,
        overdue: !!f.expectedExchangeDate && f.expectedExchangeDate < now,
        lastMilestoneAt,
        daysSilent: daysSince(lastMilestoneAt ?? anchor(f)),
      };
    });

  const supplying = [...supplyMap.values()].sort((a, b) => b.count - a.count);
  const progressors = [...loadMap.values()].sort((a, b) => {
    // Unassigned always last; otherwise busiest first.
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.count - a.count;
  });

  return {
    counts: {
      active: activeFiles.length,
      overdue,
      unassigned,
      exchangedNotCompleted,
      completed,
      supplyingAgencies: supplyMap.size,
    },
    revenue: {
      pipelinePence,
      bankedPence: banked._sum.totalPence ?? 0,
    },
    book,
    bookTotal: activeFiles.length,
    supplying,
    progressors,
  };
}

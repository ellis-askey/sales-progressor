import { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { modeProfileScope, type CommandMode } from "@/lib/command/scope";
import { eventLabel } from "@/lib/command/event-labels";

// Command Centre → Repeat use. The retention-specific data: are people coming
// back, how often, and WHO is drifting away. Every section here honours the
// SP/PM/agency scope AND excludes internal/test agencies + internal users, so a
// junk signup or Ellis's own logins never inflate the picture. (The event-type
// breakdown and agency leaderboard that used to live here moved out — Activity
// and Trends own those. See docs.)

export type ComingBackCard = { label: string; curr: number; prev: number };
export type ReturningRate = { priorActives: number; returned: number; pct: number | null };
export type SessionGaps = { p25: number | null; median: number | null; p75: number | null; n: number };

// One drifting user — active a month or two ago, silent for the last 30 days.
export type DriftUser = {
  userId: string;
  name: string;
  agencyName: string;
  role: string | null;
  lastSeen: Date;
  daysQuiet: number;
  lastAction: string;
  txId: string | null; // link target when their last action was on a file
};

export type DriftAgency = { agencyName: string; users: number; daysQuiet: number };

export type RetentionData = {
  cards: ComingBackCard[];
  returning: ReturningRate;
  gaps: SessionGaps;
  driftUsers: DriftUser[];
  driftAgencies: DriftAgency[];
  agencyCount: number;
  scopeLabel: string;
};

// Resolve the in-scope, non-internal agency IDs. SP/PM map to modeProfile; a
// specific agency selection overrides. Internal/test agencies are always out —
// this is the filter every event-based section shares, so flagging a junk
// signup internal removes it from all of them at once.
async function scopeAgencyIds(mode: CommandMode, agencyIds: string[]): Promise<string[]> {
  const where: {
    isInternal: false;
    id?: { in: string[] };
    modeProfile?: "self_progressed" | "progressor_managed";
  } = { isInternal: false };
  if (agencyIds.length > 0) where.id = { in: agencyIds };
  else if (mode === "sp") where.modeProfile = "self_progressed";
  else if (mode === "pm") where.modeProfile = "progressor_managed";
  const rows = await commandDb.agency.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

function scopeLabel(mode: CommandMode, agencyIds: string[]): string {
  if (agencyIds.length > 0) return `${agencyIds.length} agency${agencyIds.length > 1 ? "ies" : ""}`;
  if (mode === "sp") return "Self-managed";
  if (mode === "pm") return "Outsourced";
  return "All agencies";
}

// ── Second sale and beyond ────────────────────────────────────────────────────
// Agency-level transaction retention. The first sale can be a trial; a second is
// the real signal they found TSP useful enough to use again. Then 2 → 5 → 10
// shows where usage turns habitual. Migrated (bulk-imported) files and drafts
// are excluded — neither represents an agency choosing to start a new sale here.

export type TxMilestone = {
  threshold: number;                  // 1, 2, 5, 10 sales
  agencies: number;                   // agencies reaching >= threshold
  pctOfStarters: number | null;       // agencies>=threshold / agencies>=1
  stepPct: number | null;             // conversion from the previous milestone
  medianDaysFromFirst: number | null; // median days from first sale to reach it
};

export type SecondSaleCrosser = {
  agencyId: string;
  agencyName: string;
  secondAt: Date;
  daysFromFirst: number;
};

export type TxRetentionData = {
  starters: number;                   // agencies with >= 1 real sale
  milestones: TxMilestone[];
  timeToSecond: { p25: number | null; median: number | null; p75: number | null; n: number };
  recentSecond: SecondSaleCrosser[];  // reached their second in the last 90 days
};

const TX_THRESHOLDS = [1, 2, 5, 10];

function daysPercentiles(values: number[]): { p25: number | null; median: number | null; p75: number | null; n: number } {
  const n = values.length;
  if (n === 0) return { p25: null, median: null, p75: null, n: 0 };
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number): number => {
    if (s.length === 1) return s[0];
    const idx = p * (s.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return { p25: q(0.25), median: q(0.5), p75: q(0.75), n };
}

export async function getTransactionRetention(mode: CommandMode, agencyIds: string[]): Promise<TxRetentionData> {
  const scopeIds = await scopeAgencyIds(mode, agencyIds);
  const empty: TxRetentionData = {
    starters: 0,
    milestones: TX_THRESHOLDS.map((t) => ({ threshold: t, agencies: 0, pctOfStarters: null, stepPct: null, medianDaysFromFirst: null })),
    timeToSecond: { p25: null, median: null, p75: null, n: 0 },
    recentSecond: [],
  };
  if (scopeIds.length === 0) return empty;

  const txs = await commandDb.propertyTransaction.findMany({
    where: { agencyId: { in: scopeIds }, status: { not: "draft" }, isMigrated: false },
    select: { agencyId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // agencyId → ascending sale createdAts.
  const byAgency = new Map<string, Date[]>();
  for (const t of txs) {
    const arr = byAgency.get(t.agencyId);
    if (arr) arr.push(t.createdAt);
    else byAgency.set(t.agencyId, [t.createdAt]);
  }

  const starters = byAgency.size;
  if (starters === 0) return empty;

  const DAY = 86_400_000;
  const countAtLeast = (t: number): number => {
    let c = 0;
    for (const arr of byAgency.values()) if (arr.length >= t) c++;
    return c;
  };
  const daysToReach = (t: number): number[] => {
    const out: number[] = [];
    for (const arr of byAgency.values()) {
      if (arr.length >= t) out.push((arr[t - 1].getTime() - arr[0].getTime()) / DAY);
    }
    return out;
  };

  const milestones: TxMilestone[] = TX_THRESHOLDS.map((t, i) => {
    const agencies = countAtLeast(t);
    const prev = i === 0 ? starters : countAtLeast(TX_THRESHOLDS[i - 1]);
    const median = t === 1 ? null : daysPercentiles(daysToReach(t)).median;
    return {
      threshold: t,
      agencies,
      pctOfStarters: starters ? Math.round((agencies / starters) * 100) : null,
      stepPct: i === 0 ? null : prev ? Math.round((agencies / prev) * 100) : null,
      medianDaysFromFirst: median == null ? null : Math.round(median),
    };
  });

  const timeToSecond = daysPercentiles(daysToReach(2));

  // Recently activated — agencies whose SECOND sale landed in the last 90 days.
  const now = new Date();
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);
  const recent = [...byAgency.entries()]
    .filter(([, arr]) => arr.length >= 2 && arr[1] >= since90)
    .map(([agencyId, arr]) => ({ agencyId, secondAt: arr[1], daysFromFirst: Math.round((arr[1].getTime() - arr[0].getTime()) / DAY) }));

  let recentSecond: SecondSaleCrosser[] = [];
  if (recent.length > 0) {
    const names = await commandDb.agency.findMany({
      where: { id: { in: recent.map((r) => r.agencyId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((a) => [a.id, a.name] as const));
    recentSecond = recent
      .map((r) => ({ agencyId: r.agencyId, agencyName: nameById.get(r.agencyId) ?? "—", secondAt: r.secondAt, daysFromFirst: r.daysFromFirst }))
      .sort((a, b) => b.secondAt.getTime() - a.secondAt.getTime());
  }

  return { starters, milestones, timeToSecond, recentSecond };
}

export async function getRetention(mode: CommandMode, agencyIds: string[]): Promise<RetentionData> {
  const now = new Date();
  const since30 = new Date(now); since30.setUTCDate(since30.getUTCDate() - 30);
  const since60 = new Date(now); since60.setUTCDate(since60.getUTCDate() - 60);
  const since90 = new Date(now); since90.setUTCDate(since90.getUTCDate() - 90);

  const scopeIds = await scopeAgencyIds(mode, agencyIds);
  const userScope = modeProfileScope(mode, agencyIds);

  // Coming-back cards from the nightly rollup (already excludes internal/demo;
  // the all-null grand-total row carries real platform totals).
  const [current30, previous30] = await Promise.all([
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since30, lte: now }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since60, lt: since30 }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
    }),
  ]);
  const c = current30._sum;
  const p = previous30._sum;
  const cards: ComingBackCard[] = [
    { label: "People who used it", curr: c.uniqueActiveUsers ?? 0, prev: p.uniqueActiveUsers ?? 0 },
    { label: "Sign-ins", curr: c.logins ?? 0, prev: p.logins ?? 0 },
    { label: "New sign-ups", curr: c.signups ?? 0, prev: p.signups ?? 0 },
  ];

  // Empty scope → everything zero (no non-internal agencies in this view).
  if (scopeIds.length === 0) {
    return {
      cards,
      returning: { priorActives: 0, returned: 0, pct: null },
      gaps: { p25: null, median: null, p75: null, n: 0 },
      driftUsers: [],
      driftAgencies: [],
      agencyCount: 0,
      scopeLabel: scopeLabel(mode, agencyIds),
    };
  }

  // Prior-window vs recent actives → returning rate + the churned cohort.
  const [priorRows, recentRows] = await Promise.all([
    commandDb.event.findMany({
      where: { occurredAt: { gte: since60, lt: since30 }, isInternalUser: false, userId: { not: null }, agencyId: { in: scopeIds } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    commandDb.event.findMany({
      where: { occurredAt: { gte: since30 }, isInternalUser: false, userId: { not: null }, agencyId: { in: scopeIds } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  const priorIds = priorRows.map((r) => r.userId).filter((x): x is string => !!x);
  const recentSet = new Set(recentRows.map((r) => r.userId).filter(Boolean));
  const returned = priorIds.filter((id) => recentSet.has(id)).length;
  const churnedIds = priorIds.filter((id) => !recentSet.has(id));
  const returning: ReturningRate = {
    priorActives: priorIds.length,
    returned,
    pct: priorIds.length ? Math.round((returned / priorIds.length) * 100) : null,
  };

  // Session-gap percentiles — the one metric no other page shows. Filtered to
  // the in-scope non-internal agencies.
  const gapRows = await commandDb.$queryRaw<{ p25: number | null; median: number | null; p75: number | null; n: bigint }[]>`
    WITH login_gaps AS (
      SELECT EXTRACT(epoch FROM (
        "occurredAt" - LAG("occurredAt") OVER (PARTITION BY "userId" ORDER BY "occurredAt")
      )) / 3600 AS gap_hours
      FROM "Event"
      WHERE type = 'user_logged_in'
        AND "occurredAt" >= ${since90}
        AND "userId" IS NOT NULL
        AND "isInternalUser" = false
        AND "agencyId" IN (${Prisma.join(scopeIds)})
    )
    SELECT
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gap_hours) AS p25,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY gap_hours) AS median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gap_hours) AS p75,
      COUNT(*) AS n
    FROM login_gaps
    WHERE gap_hours IS NOT NULL AND gap_hours > 0.5
  `;
  const g = gapRows[0] ?? { p25: null, median: null, p75: null, n: BigInt(0) };
  const gaps: SessionGaps = { p25: g.p25, median: g.median, p75: g.p75, n: Number(g.n) };

  // The actionable churn-risk list — who each drifting user is, when they were
  // last seen, and the last thing they did (with a file link where we have one).
  let driftUsers: DriftUser[] = [];
  let driftAgencies: DriftAgency[] = [];
  if (churnedIds.length > 0) {
    const [lastEvents, users] = await Promise.all([
      commandDb.event.findMany({
        where: { userId: { in: churnedIds }, occurredAt: { gte: since90 } },
        orderBy: { occurredAt: "desc" },
        select: { userId: true, type: true, occurredAt: true, entityType: true, entityId: true },
      }),
      commandDb.user.findMany({
        where: { id: { in: churnedIds } },
        select: { id: true, name: true, role: true, agency: { select: { name: true } } },
      }),
    ]);
    const lastByUser = new Map<string, (typeof lastEvents)[number]>();
    for (const e of lastEvents) {
      if (e.userId && !lastByUser.has(e.userId)) lastByUser.set(e.userId, e);
    }
    const userById = new Map(users.map((u) => [u.id, u] as const));

    driftUsers = churnedIds
      .map((id): DriftUser | null => {
        const last = lastByUser.get(id);
        const u = userById.get(id);
        if (!last || !u) return null;
        const daysQuiet = Math.floor((now.getTime() - last.occurredAt.getTime()) / 86400_000);
        return {
          userId: id,
          name: u.name ?? "Unknown",
          agencyName: u.agency?.name ?? "—",
          role: u.role ?? null,
          lastSeen: last.occurredAt,
          daysQuiet,
          lastAction: eventLabel(last.type),
          txId: last.entityType === "PropertyTransaction" ? last.entityId : null,
        };
      })
      .filter((x): x is DriftUser => x !== null)
      // Freshest drift first — the most recoverable ones at the top.
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

    // Compact agency rollup — which agencies are going quiet.
    const byAgency = new Map<string, { users: number; mostRecent: Date }>();
    for (const d of driftUsers) {
      const row = byAgency.get(d.agencyName) ?? { users: 0, mostRecent: d.lastSeen };
      row.users += 1;
      if (d.lastSeen > row.mostRecent) row.mostRecent = d.lastSeen;
      byAgency.set(d.agencyName, row);
    }
    driftAgencies = [...byAgency.entries()]
      .map(([agencyName, r]) => ({
        agencyName,
        users: r.users,
        daysQuiet: Math.floor((now.getTime() - r.mostRecent.getTime()) / 86400_000),
      }))
      .sort((a, b) => b.users - a.users || a.daysQuiet - b.daysQuiet);
  }

  return {
    cards,
    returning,
    gaps,
    driftUsers,
    driftAgencies,
    agencyCount: scopeIds.length,
    scopeLabel: scopeLabel(mode, agencyIds),
  };
}

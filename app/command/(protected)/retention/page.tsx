import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, modeProfileScope } from "@/lib/command/scope";
import Link from "next/link";

function pctChange(curr: number | null, prev: number | null): string {
  if (!prev || prev === 0 || curr === null) return "—";
  const v = Math.round(((curr - prev) / prev) * 100);
  return v >= 0 ? `+${v}%` : `${v}%`;
}
function pctColor(curr: number | null, prev: number | null): string {
  if (!prev || prev === 0 || curr === null) return "text-neutral-600";
  return curr >= prev ? "text-emerald-400" : "text-red-400";
}
function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const userScope = modeProfileScope(mode, agencyIds);

  const now = new Date();
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since60 = new Date(now);
  since60.setUTCDate(since60.getUTCDate() - 60);
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);

  const [
    current30,
    previous30,
    featureUsage,
    powerAgencies,
    sessionGapRows,
    churnedLastEvents,
  ] = await Promise.all([
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since30, lte: now }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since60, lt: since30 }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
    }),
    // Feature usage heatmap — event type counts, last 30 days, non-internal
    commandDb.event.groupBy({
      by: ["type"],
      where: { occurredAt: { gte: since30 }, isInternalUser: false },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Power agency fingerprints — top 10 by milestones (last 30 days)
    commandDb.dailyMetric.groupBy({
      by: ["agencyId"],
      where: { date: { gte: since30 }, agencyId: { not: null } },
      _sum: { milestonesConfirmed: true, logins: true, chasesSent: true, transactionsCreated: true },
      orderBy: { _sum: { milestonesConfirmed: "desc" } },
      take: 10,
    }),
    // Time-between-sessions: median/p25/p75 gap between consecutive logins per user
    commandDb.$queryRaw<{ p25: number | null; median: number | null; p75: number | null; n: bigint }[]>`
      WITH login_gaps AS (
        SELECT
          EXTRACT(epoch FROM (
            "occurredAt" - LAG("occurredAt") OVER (PARTITION BY "userId" ORDER BY "occurredAt")
          )) / 3600 AS gap_hours
        FROM "Event"
        WHERE type = 'user_logged_in'
          AND "occurredAt" >= ${since90}
          AND "userId" IS NOT NULL
          AND "isInternalUser" = false
      )
      SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gap_hours) AS p25,
        PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY gap_hours) AS median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gap_hours) AS p75,
        COUNT(*) AS n
      FROM login_gaps
      WHERE gap_hours IS NOT NULL AND gap_hours > 0.5
    `,
    // Drop-off analysis: for users active in days 31-60 but not last 30d (churned)
    // show their most common last event types
    commandDb.$queryRaw<{ type: string; cnt: bigint }[]>`
      WITH active_before AS (
        SELECT DISTINCT "userId"
        FROM "Event"
        WHERE "occurredAt" >= ${since60} AND "occurredAt" < ${since30}
          AND "userId" IS NOT NULL
          AND "isInternalUser" = false
      ),
      active_recent AS (
        SELECT DISTINCT "userId"
        FROM "Event"
        WHERE "occurredAt" >= ${since30}
          AND "userId" IS NOT NULL
      ),
      churned AS (
        SELECT ab."userId"
        FROM active_before ab
        LEFT JOIN active_recent ar ON ar."userId" = ab."userId"
        WHERE ar."userId" IS NULL
      )
      SELECT e.type, COUNT(*) AS cnt
      FROM "Event" e
      INNER JOIN churned c ON c."userId" = e."userId"
      WHERE e."occurredAt" >= ${since60} AND e."occurredAt" < ${since30}
      GROUP BY e.type
      ORDER BY cnt DESC
      LIMIT 8
    `,
  ]);

  // Fetch agency names for power user fingerprints
  const powerIds = powerAgencies.map((r) => r.agencyId).filter((id): id is string => id !== null);
  const powerAgencyNames = powerIds.length > 0
    ? await commandDb.agency.findMany({ where: { id: { in: powerIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = Object.fromEntries(powerAgencyNames.map((a) => [a.id, a.name]));

  const c = current30._sum;
  const p = previous30._sum;
  const sessionGap = sessionGapRows[0] ?? { p25: null, median: null, p75: null, n: BigInt(0) };

  const cards = [
    { label: "Unique active users", curr: c.uniqueActiveUsers ?? 0, prev: p.uniqueActiveUsers ?? 0 },
    { label: "Logins",              curr: c.logins ?? 0,            prev: p.logins ?? 0 },
    { label: "Signups",             curr: c.signups ?? 0,           prev: p.signups ?? 0 },
  ];

  const maxFeatureCount = Math.max(1, ...featureUsage.map((r) => r._count.id));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Retention</h1>

      {/* 30-day engagement summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Engagement — last 30 days vs prior 30 days
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
              <p className="text-xs text-neutral-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{card.curr.toLocaleString()}</p>
              <p className={`text-xs tabular-nums mt-0.5 ${pctColor(card.curr, card.prev)}`}>
                {pctChange(card.curr, card.prev)} vs prev 30d
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature usage heatmap */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Feature usage — last 30 days (non-internal users)
        </h2>
        {featureUsage.length === 0 ? (
          <p className="text-sm text-neutral-600">No event data yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-neutral-800">
              {featureUsage.map((row) => {
                const barPct = (row._count.id / maxFeatureCount) * 100;
                const intensity = barPct / 100;
                const bg = intensity > 0.7
                  ? "bg-[#FF6B4A]/60"
                  : intensity > 0.3
                  ? "bg-[#FF6B4A]/30"
                  : "bg-neutral-700/40";
                return (
                  <div key={row.type} className="px-5 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-neutral-300 w-52 shrink-0 font-mono">
                      {row.type.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${bg}`} style={{ width: `${barPct.toFixed(1)}%` }} />
                    </div>
                    <span className="text-xs text-neutral-400 tabular-nums w-12 text-right shrink-0">
                      {row._count.id.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Time-between-sessions */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Time between sessions — last 90 days (n={Number(sessionGap.n)} gaps)
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
          {Number(sessionGap.n) === 0 ? (
            <p className="text-xs text-neutral-600">No login event data yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: "p25 (engaged)", v: sessionGap.p25 },
                { label: "Median (p50)", v: sessionGap.median },
                { label: "p75 (casual)",  v: sessionGap.p75 },
              ].map(({ label, v }) => (
                <div key={label} className="text-center">
                  <p className="text-[11px] text-neutral-500 mb-1">{label}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">{fmtHours(v)}</p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">gap between logins</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Power agency fingerprints */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Power agencies — last 30 days
        </h2>
        {powerAgencies.length === 0 ? (
          <p className="text-sm text-neutral-600">No per-agency data yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Agency</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Logins</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Chases</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {powerAgencies.map((row, i) => (
                  <tr key={row.agencyId ?? i} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-neutral-200">
                      {row.agencyId ? (nameMap[row.agencyId] ?? row.agencyId.slice(0, 8)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white font-semibold">
                      {(row._sum.milestonesConfirmed ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                      {(row._sum.logins ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                      {(row._sum.chasesSent ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                      {(row._sum.transactionsCreated ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drop-off analysis */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Drop-off analysis — churned user last actions
        </h2>
        <p className="text-[11px] text-neutral-600 mb-4">
          Users active in days 31–60 but absent in the last 30 days — what were they doing before they left?
        </p>
        {churnedLastEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">No churned users in this window (or no event data).</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Last action before churn</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-neutral-500">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {churnedLastEvents.map((row) => (
                  <tr key={row.type} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-neutral-200 font-mono">
                      {row.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums text-white font-medium">
                      {Number(row.cnt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cohort pointer */}
      <section>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-neutral-300">Signup cohort retention table</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Week-1 / 2 / 4 / 8 / 12 retention by cohort — see the Growth tab.
            </p>
          </div>
          <Link href="/command/growth" className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors shrink-0">
            Go to Growth →
          </Link>
        </div>
      </section>
    </div>
  );
}

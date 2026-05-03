import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope, cohortModeFilter } from "@/lib/command/scope";
import WhatChanged from "@/components/command/shared/WhatChanged";

function weekLabel(d: Date): string {
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  const dow = day.getUTCDay();
  const diff = (dow === 0 ? -6 : 1 - dow);
  day.setUTCDate(day.getUTCDate() + diff);
  return day.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function fmtWeek(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

type DailyRow = Awaited<ReturnType<typeof commandDb.dailyMetric.findMany>>[0];

function sumField(rows: DailyRow[], field: keyof DailyRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

function pct(n: number, base: number): string {
  if (base === 0) return "—";
  return `${Math.round((n / base) * 100)}%`;
}

function cohortPctColor(n: number, base: number): string {
  if (base === 0) return "text-neutral-600";
  const r = n / base;
  if (r >= 0.6) return "text-emerald-400";
  if (r >= 0.3) return "text-amber-400";
  return "text-red-400";
}

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const txScope = serviceTypeScope(mode, agencyIds);
  const cohortFilter = cohortModeFilter(mode);

  const now = new Date();
  const since7 = new Date(now);
  since7.setUTCDate(since7.getUTCDate() - 7);
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);

  const [
    globalRows,
    byServiceType,
    byModeProfile,
    funnelData,
    agencyLeaderboard,
    acquisitionSources,
    cohorts,
  ] = await Promise.all([
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since90 }, ...txScope },
      orderBy: { date: "asc" },
    }),
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30 }, agencyId: null, serviceType: { not: null }, modeProfile: null },
      orderBy: { date: "asc" },
    }),
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30 }, agencyId: null, serviceType: null, modeProfile: { not: null } },
      orderBy: { date: "asc" },
    }),
    // Funnel totals for last 30 days (global roll-up rows)
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since30 }, agencyId: null, serviceType: null, modeProfile: null },
      _sum: { signups: true, logins: true, uniqueActiveUsers: true, transactionsCreated: true, milestonesConfirmed: true },
    }),
    // Agency leaderboard — per-agency metric sums for last 30 days
    commandDb.dailyMetric.groupBy({
      by: ["agencyId"],
      where: { date: { gte: since30 }, agencyId: { not: null } },
      _sum: { milestonesConfirmed: true, transactionsCreated: true, chasesSent: true, signups: true },
      orderBy: { _sum: { milestonesConfirmed: "desc" } },
      take: 20,
    }),
    // Acquisition source breakdown from Agency table
    commandDb.agency.groupBy({
      by: ["signupSource"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Cohort data (moved from Retention)
    commandDb.weeklyCohort.findMany({
      where: cohortFilter,
      orderBy: { signupWeek: "desc" },
      take: 24,
    }),
  ]);

  // Fetch agency names for leaderboard
  const leaderboardAgencyIds = agencyLeaderboard
    .map((r) => r.agencyId)
    .filter((id): id is string => id !== null);
  const agencyList = leaderboardAgencyIds.length > 0
    ? await commandDb.agency.findMany({
        where: { id: { in: leaderboardAgencyIds } },
        select: { id: true, name: true },
      })
    : [];
  const agencyNameMap = Object.fromEntries(agencyList.map((a) => [a.id, a.name]));

  // Weekly trend bucketing
  type WeekBucket = { week: string; signups: number; txns: number; milestones: number; chases: number };
  const weekMap = new Map<string, WeekBucket>();
  for (const row of globalRows) {
    const w = weekLabel(row.date);
    const bucket = weekMap.get(w) ?? { week: w, signups: 0, txns: 0, milestones: 0, chases: 0 };
    bucket.signups    += row.signups;
    bucket.txns       += row.transactionsCreated;
    bucket.milestones += row.milestonesConfirmed;
    bucket.chases     += row.chasesSent;
    weekMap.set(w, bucket);
  }
  const weeklyRows = Array.from(weekMap.values()).reverse();

  // Service type map
  const stMap = new Map<string, DailyRow[]>();
  for (const row of byServiceType) {
    const key = row.serviceType ?? "unknown";
    const arr = stMap.get(key) ?? [];
    arr.push(row);
    stMap.set(key, arr);
  }

  // Mode profile map
  const mpMap = new Map<string, DailyRow[]>();
  for (const row of byModeProfile) {
    const key = row.modeProfile ?? "unknown";
    const arr = mpMap.get(key) ?? [];
    arr.push(row);
    mpMap.set(key, arr);
  }

  // Funnel steps
  const fs = funnelData._sum;
  const funnelSignups = fs.signups ?? 0;
  const funnelSteps = [
    { label: "Signups",                n: funnelSignups },
    { label: "Logged in",              n: fs.logins ?? 0 },
    { label: "Unique active users",    n: fs.uniqueActiveUsers ?? 0 },
    { label: "Created a transaction",  n: fs.transactionsCreated ?? 0 },
    { label: "Confirmed a milestone",  n: fs.milestonesConfirmed ?? 0 },
  ];

  const latestCohorts = cohorts.slice(0, 4);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Growth</h1>

      {/* Activation funnel */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Activation funnel — last 30 days
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-neutral-800">
            {funnelSteps.map((step, i) => {
              const barPct = funnelSignups > 0 ? (step.n / funnelSignups) * 100 : 0;
              const dropFromPrev = i > 0 && funnelSteps[i - 1].n > 0
                ? Math.round(((step.n - funnelSteps[i - 1].n) / funnelSteps[i - 1].n) * 100)
                : null;
              return (
                <div key={step.label} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-40 shrink-0">
                    <p className="text-xs text-neutral-300">{step.label}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF6B4A]/70"
                        style={{ width: `${barPct.toFixed(1)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums w-12 text-right shrink-0">
                      {step.n.toLocaleString()}
                    </span>
                    <span className="text-xs text-neutral-500 tabular-nums w-10 text-right shrink-0">
                      {funnelSignups > 0 ? `${Math.round(barPct)}%` : "—"}
                    </span>
                    {dropFromPrev !== null && (
                      <span className={`text-[11px] tabular-nums w-12 text-right shrink-0 ${dropFromPrev < 0 ? "text-red-400" : "text-neutral-600"}`}>
                        {dropFromPrev < 0 ? `${dropFromPrev}%` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Weekly growth trend */}
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Weekly trend — last 90 days (w/c Monday)
          </h2>
          <WhatChanged windowStart={since7} windowEnd={now} />
        </div>
        {weeklyRows.length === 0 ? (
          <p className="text-sm text-neutral-600">No rollup data yet. Cron runs nightly.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Week</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Signups</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns created</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Chases sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {weeklyRows.map((w) => (
                    <tr key={w.week} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-neutral-400 whitespace-nowrap">{w.week}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200 font-medium">{w.signups}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{w.txns}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{w.milestones}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{w.chases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Agency leaderboard */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Agency leaderboard — last 30 days (by milestones)
        </h2>
        {agencyLeaderboard.length === 0 ? (
          <p className="text-sm text-neutral-600">No per-agency data yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Agency</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Signups</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Chases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {agencyLeaderboard.map((row, i) => (
                    <tr key={row.agencyId ?? i} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-neutral-600 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5 text-xs text-neutral-200">
                        {row.agencyId ? (agencyNameMap[row.agencyId] ?? row.agencyId.slice(0, 8)) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white font-medium">
                        {(row._sum.milestonesConfirmed ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                        {(row._sum.transactionsCreated ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                        {(row._sum.signups ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">
                        {(row._sum.chasesSent ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Acquisition sources */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Acquisition sources — all time
        </h2>
        {acquisitionSources.length === 0 ? (
          <p className="text-sm text-neutral-600">No UTM source data captured yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Source</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-neutral-500">Agencies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {acquisitionSources.map((row) => (
                  <tr key={row.signupSource ?? "direct"}>
                    <td className="px-5 py-2.5 text-xs text-neutral-200">
                      {row.signupSource ?? <span className="text-neutral-500">direct / unknown</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums text-white font-medium">
                      {row._count.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Breakdown by service type + mode profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            By service type — last 30 days
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Signups</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {stMap.size === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-4 text-xs text-neutral-600">No data yet.</td></tr>
                ) : (
                  Array.from(stMap.entries()).map(([st, rows]) => (
                    <tr key={st}>
                      <td className="px-5 py-2.5 text-xs text-neutral-200 capitalize">{st.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200">{sumField(rows, "signups")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{sumField(rows, "transactionsCreated")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{sumField(rows, "milestonesConfirmed")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            By mode profile — last 30 days
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Mode</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Signups</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {mpMap.size === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-4 text-xs text-neutral-600">No data yet.</td></tr>
                ) : (
                  Array.from(mpMap.entries()).map(([mp, rows]) => (
                    <tr key={mp}>
                      <td className="px-5 py-2.5 text-xs text-neutral-200 capitalize">{mp.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200">{sumField(rows, "signups")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{sumField(rows, "transactionsCreated")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{sumField(rows, "milestonesConfirmed")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Weekly cohorts (moved from Retention) */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Signup cohorts — retention at each interval
        </h2>

        {latestCohorts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {latestCohorts.map((c) => (
              <div key={c.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-200">w/c {fmtWeek(c.signupWeek)}</p>
                    <p className="text-[11px] text-neutral-600 capitalize">{c.modeProfile.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{c.cohortSize}</p>
                    <p className="text-[10px] text-neutral-600">cohort size</p>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Wk 1", n: c.activeWeek1 },
                    { label: "Wk 2", n: c.activeWeek2 },
                    { label: "Wk 4", n: c.activeWeek4 },
                    { label: "Wk 8", n: c.activeWeek8 },
                    { label: "Wk 12", n: c.activeWeek12 },
                  ].map(({ label, n }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] text-neutral-600 mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold tabular-nums ${cohortPctColor(n, c.cohortSize)}`}>
                        {pct(n, c.cohortSize)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {cohorts.length === 0 ? (
          <p className="text-sm text-neutral-600">No cohort data yet. Cron runs nightly.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 whitespace-nowrap">Signup week</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Mode</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Size</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Wk 1</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Wk 2</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Wk 4</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Wk 8</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Wk 12</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-neutral-400 whitespace-nowrap">{fmtWeek(c.signupWeek)}</td>
                      <td className="px-4 py-2.5 text-xs text-neutral-500 capitalize">{c.modeProfile.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200">{c.cohortSize}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${cohortPctColor(c.activeWeek1, c.cohortSize)}`}>{pct(c.activeWeek1, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${cohortPctColor(c.activeWeek2, c.cohortSize)}`}>{pct(c.activeWeek2, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${cohortPctColor(c.activeWeek4, c.cohortSize)}`}>{pct(c.activeWeek4, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${cohortPctColor(c.activeWeek8, c.cohortSize)}`}>{pct(c.activeWeek8, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${cohortPctColor(c.activeWeek12, c.cohortSize)}`}>{pct(c.activeWeek12, c.cohortSize)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

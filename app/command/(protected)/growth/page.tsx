import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope, cohortModeFilter } from "@/lib/command/scope";
import { internalAgencyFilter } from "@/lib/security/internal-accounts";
import WhatChanged from "@/components/command/shared/WhatChanged";
import InfoTip from "@/components/command/shared/InfoTip";

// Command Centre → Trends. Platform-level trends over time, segment breakdowns,
// acquisition, and signup cohorts. The activation funnel lives on Getting
// started (it owns the real cohort funnel); we point there rather than repeat a
// broken copy.

export const dynamic = "force-dynamic";

// Cohorts below this size can only ever read 0% or 100%, so we show them muted
// rather than alarming red/green.
const MIN_RELIABLE_COHORT = 3;

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

// Has the week-N measurement window for this cohort actually arrived yet? The
// rollup writes 0 for future windows; without this we'd render "not yet
// measured" as a red 0% retained.
function intervalReached(signupWeek: Date, weeks: number, now: Date): boolean {
  const d = new Date(signupWeek);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d <= now;
}

function cohortPctColor(n: number, base: number, reliable: boolean): string {
  if (base === 0 || !reliable) return "text-neutral-500";
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
    leaderboardRaw,
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
    // Agency leaderboard — per-agency metric sums for last 30 days. Take extra so
    // that after we drop deleted/internal/zero-activity rows we still have a full
    // top 20.
    commandDb.dailyMetric.groupBy({
      by: ["agencyId"],
      where: { date: { gte: since30 }, agencyId: { not: null } },
      _sum: { milestonesConfirmed: true, transactionsCreated: true, chasesSent: true, signups: true },
      orderBy: { _sum: { milestonesConfirmed: "desc" } },
      take: 40,
    }),
    // Acquisition source breakdown — real customer agencies only.
    commandDb.agency.groupBy({
      by: ["signupSource"],
      where: internalAgencyFilter,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Signup cohorts (owned here; Repeat use points at this).
    commandDb.weeklyCohort.findMany({
      where: cohortFilter,
      orderBy: { signupWeek: "desc" },
      take: 24,
    }),
  ]);

  // Resolve which leaderboard agencyIds are REAL, non-internal agencies. Anything
  // not in this map is a deleted-agency orphan or an internal/test account, and
  // is dropped. We also drop rows with no activity in the window.
  const leaderboardIds = leaderboardRaw
    .map((r) => r.agencyId)
    .filter((id): id is string => id !== null);
  const realAgencies = leaderboardIds.length > 0
    ? await commandDb.agency.findMany({
        where: { id: { in: leaderboardIds }, ...internalAgencyFilter },
        select: { id: true, name: true },
      })
    : [];
  const agencyNameMap = Object.fromEntries(realAgencies.map((a) => [a.id, a.name]));
  const agencyLeaderboard = leaderboardRaw
    .filter((r) => {
      if (!r.agencyId || !agencyNameMap[r.agencyId]) return false; // orphan / internal
      const s = r._sum;
      return (s.milestonesConfirmed ?? 0) + (s.transactionsCreated ?? 0) + (s.chasesSent ?? 0) + (s.signups ?? 0) > 0;
    })
    .slice(0, 20);

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

  const latestCohorts = cohorts.slice(0, 4);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Trends</h1>

      {/* Activation funnel now lives on Getting started — point, don't duplicate */}
      <section>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-neutral-300">Activation funnel</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Where new sign-ups reach their first sale and first milestone, and where they drop off, lives on Getting started.
            </p>
          </div>
          <Link href="/command/activation" className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors shrink-0">
            Go to Getting started →
          </Link>
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
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="Agency leaderboard">Customer agencies ranked by milestones confirmed in the last 30 days. Excludes internal, test, and deleted accounts, and agencies with no activity in the window. Click an agency for its detail.</InfoTip></span>
        </h2>
        {agencyLeaderboard.length === 0 ? (
          <p className="text-sm text-neutral-600">No agency activity in the last 30 days.</p>
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
                        {row.agencyId ? (
                          <Link href={`/command/revenue/${row.agencyId}`} className="hover:text-white underline decoration-neutral-700">
                            {agencyNameMap[row.agencyId]}
                          </Link>
                        ) : "—"}
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
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="Acquisition sources">How customer agencies found us, from the signup source captured at registration. Internal and test accounts are excluded. &ldquo;direct / unknown&rdquo; is anyone with no source recorded.</InfoTip></span>
        </h2>
        {acquisitionSources.length === 0 ? (
          <p className="text-sm text-neutral-600">No source data captured yet.</p>
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
            <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="By service type">How the file is billed: self-managed (£59, the agency runs it) vs outsourced (£250+, we run it). Distinct from mode profile, which is about who progresses the work.</InfoTip></span>
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
            <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="By mode profile">Who progresses the work: self-progressed (the agency), progressor-managed (our team), or mixed. Derived from actual activity, so it can differ from how the file is billed.</InfoTip></span>
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

      {/* Weekly cohorts */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Signup cohorts — retention at each interval
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="Signup cohorts">Of the agencies that joined in a given week, the share still active 1, 2, 4, 8, and 12 weeks later. A dash means that week hasn&rsquo;t arrived yet. Cohorts of fewer than {MIN_RELIABLE_COHORT} are shown muted because a single agency can only read 0% or 100%.</InfoTip></span>
        </h2>
        <p className="text-[11px] text-neutral-600 mb-4">
          Most cohorts here are one or two agencies, so treat the percentages as directional. A dash is a window that hasn&rsquo;t been reached yet, not a zero.
        </p>

        {latestCohorts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {latestCohorts.map((c) => {
              const reliable = c.cohortSize >= MIN_RELIABLE_COHORT;
              return (
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
                      { label: "Wk 1", n: c.activeWeek1, w: 1 },
                      { label: "Wk 2", n: c.activeWeek2, w: 2 },
                      { label: "Wk 4", n: c.activeWeek4, w: 4 },
                      { label: "Wk 8", n: c.activeWeek8, w: 8 },
                      { label: "Wk 12", n: c.activeWeek12, w: 12 },
                    ].map(({ label, n, w }) => {
                      const reached = intervalReached(c.signupWeek, w, now);
                      return (
                        <div key={label} className="text-center">
                          <p className="text-[10px] text-neutral-600 mb-0.5">{label}</p>
                          <p className={`text-sm font-semibold tabular-nums ${reached ? cohortPctColor(n, c.cohortSize, reliable) : "text-neutral-700"}`}>
                            {reached ? pct(n, c.cohortSize) : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                  {cohorts.map((c) => {
                    const reliable = c.cohortSize >= MIN_RELIABLE_COHORT;
                    const cells = [
                      { n: c.activeWeek1, w: 1 },
                      { n: c.activeWeek2, w: 2 },
                      { n: c.activeWeek4, w: 4 },
                      { n: c.activeWeek8, w: 8 },
                      { n: c.activeWeek12, w: 12 },
                    ];
                    return (
                      <tr key={c.id} className="hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-neutral-400 whitespace-nowrap">{fmtWeek(c.signupWeek)}</td>
                        <td className="px-4 py-2.5 text-xs text-neutral-500 capitalize">{c.modeProfile.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200">{c.cohortSize}</td>
                        {cells.map(({ n, w }) => {
                          const reached = intervalReached(c.signupWeek, w, now);
                          return (
                            <td key={w} className={`px-4 py-2.5 text-right text-xs tabular-nums ${reached ? cohortPctColor(n, c.cohortSize, reliable) : "text-neutral-700"}`}>
                              {reached ? pct(n, c.cohortSize) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

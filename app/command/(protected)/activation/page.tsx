import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope, modeProfileScope } from "@/lib/command/scope";
import WhatChanged from "@/components/command/shared/WhatChanged";
import Link from "next/link";

function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+∞" : "—";
  const v = Math.round(((curr - prev) / prev) * 100);
  return v >= 0 ? `+${v}%` : `${v}%`;
}

function pctColor(curr: number, prev: number): string {
  if (prev === 0 || curr === prev) return "text-neutral-600";
  return curr > prev ? "text-emerald-400" : "text-red-400";
}

function conversionPctColor(r: number): string {
  if (r >= 0.6) return "text-emerald-400";
  if (r >= 0.3) return "text-amber-400";
  return "text-red-400";
}

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const txScope   = serviceTypeScope(mode, agencyIds);
  const userScope = modeProfileScope(mode, agencyIds);

  const now = new Date();
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since60 = new Date(now);
  since60.setUTCDate(since60.getUTCDate() - 60);
  const since7 = new Date(now);
  since7.setUTCDate(since7.getUTCDate() - 7);
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);

  const [txRows30, txRows60, userRows30, userRows60, cohortAgencyEvents] = await Promise.all([
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30, lte: now }, ...txScope },
      orderBy: { date: "desc" },
    }),
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since60, lt: since30 }, ...txScope },
      orderBy: { date: "desc" },
    }),
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30, lte: now }, ...userScope },
      orderBy: { date: "desc" },
    }),
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since60, lt: since30 }, ...userScope },
      orderBy: { date: "desc" },
    }),
    // Cohort agencies: unique agencyIds from agency_created in last 30 days
    commandDb.event.findMany({
      where: { type: "agency_created", occurredAt: { gte: since30 }, agencyId: { not: null } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    }),
  ]);

  const cohortIds = cohortAgencyEvents.map((e) => e.agencyId as string);

  // Event funnel — for each step, distinct agencyIds from cohort that reached it
  const [loggedInAgencies, txnAgencies, milestoneAgencies] = cohortIds.length === 0
    ? [[] as { agencyId: string | null }[], [] as { agencyId: string | null }[], [] as { agencyId: string | null }[]]
    : await Promise.all([
        commandDb.event.findMany({
          where: { type: "user_logged_in", agencyId: { in: cohortIds } },
          select: { agencyId: true },
          distinct: ["agencyId"],
        }),
        commandDb.event.findMany({
          where: { type: "transaction_created", agencyId: { in: cohortIds } },
          select: { agencyId: true },
          distinct: ["agencyId"],
        }),
        commandDb.event.findMany({
          where: { type: "milestone_confirmed", agencyId: { in: cohortIds } },
          select: { agencyId: true },
          distinct: ["agencyId"],
        }),
      ]);

  const funnelSteps = [
    { label: "Agency signed up",      n: cohortIds.length,              metric: "signups" },
    { label: "Logged in",             n: loggedInAgencies.length,       metric: "logins" },
    { label: "Created a transaction", n: txnAgencies.length,            metric: "transactions" },
    { label: "Confirmed a milestone", n: milestoneAgencies.length,      metric: "milestones" },
  ];

  // Time-to-first-transaction percentiles (last 90 days cohort) via raw SQL
  type PercentilesRow = { median_days: number | null; p75_days: number | null; p90_days: number | null; n: bigint };
  const ttftRows = await commandDb.$queryRaw<PercentilesRow[]>`
    WITH cohort AS (
      SELECT "agencyId", MIN("occurredAt") AS created_at
      FROM "Event"
      WHERE type = 'agency_created'
        AND "occurredAt" >= ${since90}
        AND "agencyId" IS NOT NULL
      GROUP BY "agencyId"
    ),
    first_txn AS (
      SELECT "agencyId", MIN("occurredAt") AS first_txn_at
      FROM "Event"
      WHERE type = 'transaction_created'
        AND "agencyId" IS NOT NULL
      GROUP BY "agencyId"
    )
    SELECT
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS median_days,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS p75_days,
      PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS p90_days,
      COUNT(*) AS n
    FROM cohort c
    INNER JOIN first_txn ft ON ft."agencyId" = c."agencyId"
  `;
  const ttft = ttftRows[0] ?? { median_days: null, p75_days: null, p90_days: null, n: BigInt(0) };

  // Time-to-first-milestone-after-transaction percentiles
  type PercentilesRow2 = { median_days: number | null; p75_days: number | null; n: bigint };
  const ttfmRows = await commandDb.$queryRaw<PercentilesRow2[]>`
    WITH first_txn AS (
      SELECT "agencyId", MIN("occurredAt") AS first_txn_at
      FROM "Event"
      WHERE type = 'transaction_created'
        AND "occurredAt" >= ${since90}
        AND "agencyId" IS NOT NULL
      GROUP BY "agencyId"
    ),
    first_ms AS (
      SELECT "agencyId", MIN("occurredAt") AS first_ms_at
      FROM "Event"
      WHERE type = 'milestone_confirmed'
        AND "agencyId" IS NOT NULL
      GROUP BY "agencyId"
    )
    SELECT
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fm.first_ms_at - ft.first_txn_at)) / 86400) AS median_days,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fm.first_ms_at - ft.first_txn_at)) / 86400) AS p75_days,
      COUNT(*) AS n
    FROM first_txn ft
    INNER JOIN first_ms fm ON fm."agencyId" = ft."agencyId"
    WHERE fm.first_ms_at > ft.first_txn_at
  `;
  const ttfm = ttfmRows[0] ?? { median_days: null, p75_days: null, n: BigInt(0) };

  // First-action cohort table by signup bucket
  type BucketRow = { agencyId: string | null };
  const [bucket7, bucket8_30, bucket31_90] = await Promise.all([
    commandDb.event.findMany({
      where: { type: "agency_created", occurredAt: { gte: since7 }, agencyId: { not: null } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    }),
    commandDb.event.findMany({
      where: { type: "agency_created", occurredAt: { gte: since30, lt: since7 }, agencyId: { not: null } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    }),
    commandDb.event.findMany({
      where: { type: "agency_created", occurredAt: { gte: since90, lt: since30 }, agencyId: { not: null } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    }),
  ]);

  async function countReached(ids: string[], eventType: string): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await commandDb.event.findMany({
      where: { type: eventType as never, agencyId: { in: ids } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    });
    return rows.length;
  }

  const b7ids  = bucket7.map((r: BucketRow)      => r.agencyId as string);
  const b30ids = bucket8_30.map((r: BucketRow)   => r.agencyId as string);
  const b90ids = bucket31_90.map((r: BucketRow)  => r.agencyId as string);

  const [b7txn, b30txn, b90txn, b7ms, b30ms, b90ms] = await Promise.all([
    countReached(b7ids,  "transaction_created"),
    countReached(b30ids, "transaction_created"),
    countReached(b90ids, "transaction_created"),
    countReached(b7ids,  "milestone_confirmed"),
    countReached(b30ids, "milestone_confirmed"),
    countReached(b90ids, "milestone_confirmed"),
  ]);

  const cohortBuckets = [
    { label: "Last 7 days",    total: b7ids.length,  txn: b7txn,  ms: b7ms },
    { label: "Days 8-30",      total: b30ids.length, txn: b30txn, ms: b30ms },
    { label: "Days 31-90",     total: b90ids.length, txn: b90txn, ms: b90ms },
  ];

  // Original 30-day summary cards
  const rows30 = txRows30.map((r) => {
    const ur = userRows30.find((u) => u.date.getTime() === r.date.getTime());
    return { ...r, signups: ur?.signups ?? r.signups, logins: ur?.logins ?? r.logins, uniqueActiveUsers: ur?.uniqueActiveUsers ?? r.uniqueActiveUsers };
  });

  type DRow = typeof txRows30[0];
  const sumField = (rows: DRow[], field: keyof DRow) =>
    rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

  const curr = {
    signups:           sumField(userRows30, "signups"),
    logins:            sumField(userRows30, "logins"),
    uniqueActiveUsers: sumField(userRows30, "uniqueActiveUsers"),
    txnsCreated:       sumField(txRows30, "transactionsCreated"),
    milestones:        sumField(txRows30, "milestonesConfirmed"),
  };
  const prev = {
    signups:           sumField(userRows60, "signups"),
    logins:            sumField(userRows60, "logins"),
    uniqueActiveUsers: sumField(userRows60, "uniqueActiveUsers"),
    txnsCreated:       sumField(txRows60, "transactionsCreated"),
    milestones:        sumField(txRows60, "milestonesConfirmed"),
  };

  const funnelRate = (n: number) =>
    curr.signups === 0 ? "—" : `${Math.round((n / curr.signups) * 100)}%`;

  const summaryCards = [
    { label: "Signups",          metric: "signups",      curr: curr.signups,           prev: prev.signups },
    { label: "Logins",           metric: "logins",       curr: curr.logins,            prev: prev.logins },
    { label: "Unique actives",   metric: "active_users", curr: curr.uniqueActiveUsers, prev: prev.uniqueActiveUsers },
    { label: "Txns created",     metric: "transactions", curr: curr.txnsCreated,       prev: prev.txnsCreated },
    { label: "Milestones conf.", metric: "milestones",   curr: curr.milestones,        prev: prev.milestones },
  ];

  function fmtDays(d: number | null): string {
    if (d === null) return "—";
    if (d < 1) return `${Math.round(d * 24)}h`;
    return `${d.toFixed(1)}d`;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Activation</h1>

      {/* 30-day summary vs prior 30 */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Last 30 days vs prior 30 days
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {summaryCards.map((c) => (
            <div key={c.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
              <p className="text-xs text-neutral-400 mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{c.curr.toLocaleString()}</p>
              <p className={`text-xs tabular-nums mt-0.5 ${pctColor(c.curr, c.prev)}`}>
                {pctChange(c.curr, c.prev)} vs prev 30d
              </p>
              <WhatChanged windowStart={since30} windowEnd={now} metric={c.metric} />
            </div>
          ))}
        </div>
      </section>

      {/* Event-level drop-off chain (cohort from last 30d signups) */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Drop-off chain — agencies signed up in last 30 days (n={cohortIds.length})
        </h2>
        <p className="text-[11px] text-neutral-600 mb-4">Distinct agencies that reached each step at any time since signup.</p>
        {cohortIds.length === 0 ? (
          <p className="text-sm text-neutral-600">No new agencies in the last 30 days.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-neutral-800">
              {funnelSteps.map((step, i) => {
                const base = funnelSteps[0].n;
                const barPct = base > 0 ? (step.n / base) * 100 : 0;
                const dropFromPrev = i > 0 && funnelSteps[i - 1].n > 0
                  ? Math.round(((step.n - funnelSteps[i - 1].n) / funnelSteps[i - 1].n) * 100)
                  : null;
                const convRate = base > 0 ? step.n / base : 0;
                return (
                  <div key={step.label} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-44 shrink-0">
                      <p className="text-xs text-neutral-300">{step.label}</p>
                    </div>
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF6B4A]/60"
                        style={{ width: `${barPct.toFixed(1)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums w-10 text-right shrink-0">
                      {step.n}
                    </span>
                    <span className={`text-xs tabular-nums w-10 text-right shrink-0 ${conversionPctColor(convRate)}`}>
                      {base > 0 ? `${Math.round(barPct)}%` : "—"}
                    </span>
                    {dropFromPrev !== null && (
                      <span className={`text-[11px] tabular-nums w-12 text-right shrink-0 ${dropFromPrev < 0 ? "text-red-400" : "text-neutral-600"}`}>
                        {dropFromPrev < 0 ? `${dropFromPrev}%` : ""}
                      </span>
                    )}
                    {i > 0 && step.n < funnelSteps[i - 1].n * 0.7 && (
                      <Link
                        href="/command/experiments"
                        className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors shrink-0 border border-amber-900 rounded px-1.5 py-0.5"
                      >
                        Fix this →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Time-to-X percentiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Time to first transaction — last 90 days (n={Number(ttft.n)})
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
            {[
              { label: "Median (p50)", v: ttft.median_days },
              { label: "p75",          v: ttft.p75_days },
              { label: "p90",          v: ttft.p90_days },
            ].map(({ label, v }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">{label}</span>
                <span className="text-sm font-bold text-white tabular-nums">{fmtDays(v)}</span>
              </div>
            ))}
            {Number(ttft.n) === 0 && (
              <p className="text-[11px] text-neutral-600">No event data yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Time from transaction → first milestone — last 90 days (n={Number(ttfm.n)})
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
            {[
              { label: "Median (p50)", v: ttfm.median_days },
              { label: "p75",          v: ttfm.p75_days },
            ].map(({ label, v }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">{label}</span>
                <span className="text-sm font-bold text-white tabular-nums">{fmtDays(v)}</span>
              </div>
            ))}
            {Number(ttfm.n) === 0 && (
              <p className="text-[11px] text-neutral-600">No event data yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* First-action cohort table by signup bucket */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          First-action cohort — by signup recency
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Signup bucket</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Agencies</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Created txn</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txn rate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Confirmed ms</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Ms rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {cohortBuckets.map((b) => {
                const txnRate = b.total > 0 ? b.txn / b.total : 0;
                const msRate  = b.total > 0 ? b.ms  / b.total : 0;
                return (
                  <tr key={b.label} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-neutral-300">{b.label}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200 font-medium">{b.total}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{b.txn}</td>
                    <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${conversionPctColor(txnRate)}`}>
                      {b.total > 0 ? `${Math.round(txnRate * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{b.ms}</td>
                    <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${conversionPctColor(msRate)}`}>
                      {b.total > 0 ? `${Math.round(msRate * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Standard activation funnel */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Activation funnel — last 30 days (base: signups)
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Stage</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-neutral-500">Count</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-neutral-500">% of signups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {[
                { label: "Signups",              n: curr.signups           },
                { label: "Logins (any)",         n: curr.logins            },
                { label: "Unique active users",  n: curr.uniqueActiveUsers },
                { label: "Created a transaction",n: curr.txnsCreated       },
                { label: "Confirmed a milestone",n: curr.milestones        },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3 text-neutral-300 text-xs">{row.label}</td>
                  <td className="px-5 py-3 text-right text-white tabular-nums text-xs font-medium">
                    {row.n.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-neutral-400 tabular-nums text-xs">
                    {funnelRate(row.n)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Day-by-day table */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Day-by-day — last 30 days
        </h2>
        {rows30.length === 0 ? (
          <p className="text-sm text-neutral-600">No rollup data yet. Cron runs nightly.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 whitespace-nowrap">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Signups</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Logins</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Actives</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Txns</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {rows30.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-neutral-400 whitespace-nowrap">{fmtDay(r.date)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200">{r.signups}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{r.logins}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{r.uniqueActiveUsers}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{r.transactionsCreated}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{r.milestonesConfirmed}</td>
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

import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope, modeProfileScope } from "@/lib/command/scope";
import InfoTip from "@/components/command/shared/InfoTip";
import type { AgencyModeProfile } from "@prisma/client";

function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
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
function rateColor(r: number): string {
  if (r >= 0.6) return "text-emerald-400";
  if (r >= 0.3) return "text-amber-400";
  return "text-red-400";
}
function fmtDays(d: number | null): string {
  if (d === null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${d.toFixed(1)}d`;
}

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const txScope = serviceTypeScope(mode, agencyIds);
  const userScope = modeProfileScope(mode, agencyIds);

  const now = new Date();
  const since = (days: number) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - days); return d; };
  const since7 = since(7), since30 = since(30), since60 = since(60), since90 = since(90);

  // Agency cohort filter — real customers only, honouring the SP/PM/agency scope.
  const agencyWhere: { isInternal: false; id?: { in: string[] }; modeProfile?: AgencyModeProfile } = { isInternal: false };
  if (agencyIds.length > 0) agencyWhere.id = { in: agencyIds };
  else if (mode === "sp") agencyWhere.modeProfile = "self_progressed";
  else if (mode === "pm") agencyWhere.modeProfile = "progressor_managed";

  const [txRows30, userRows30, txRows60, userRows60, agencies, ttftRows, ttfmRows] = await Promise.all([
    commandDb.dailyMetric.findMany({ where: { date: { gte: since30, lte: now }, ...txScope }, orderBy: { date: "desc" } }),
    commandDb.dailyMetric.findMany({ where: { date: { gte: since30, lte: now }, ...userScope }, orderBy: { date: "desc" } }),
    commandDb.dailyMetric.findMany({ where: { date: { gte: since60, lt: since30 }, ...txScope } }),
    commandDb.dailyMetric.findMany({ where: { date: { gte: since60, lt: since30 }, ...userScope } }),
    // The cohort: every real customer agency, with when it joined.
    commandDb.agency.findMany({ where: agencyWhere, select: { id: true, createdAt: true } }),
    // Time from joining to first sale (last 90d joiners), internal excluded.
    commandDb.$queryRaw<{ median_days: number | null; p75_days: number | null; p90_days: number | null; n: bigint }[]>`
      WITH cohort AS (
        SELECT e."agencyId", MIN(e."occurredAt") AS created_at
        FROM "Event" e JOIN "Agency" a ON a.id = e."agencyId"
        WHERE e.type = 'agency_created' AND e."occurredAt" >= ${since90}
          AND e."agencyId" IS NOT NULL AND a."isInternal" = false
        GROUP BY e."agencyId"
      ),
      first_txn AS (
        SELECT "agencyId", MIN("occurredAt") AS first_txn_at FROM "Event"
        WHERE type = 'transaction_created' AND "agencyId" IS NOT NULL GROUP BY "agencyId"
      )
      SELECT
        PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS median_days,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS p75_days,
        PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (ft.first_txn_at - c.created_at)) / 86400) AS p90_days,
        COUNT(*) AS n
      FROM cohort c INNER JOIN first_txn ft ON ft."agencyId" = c."agencyId"
    `,
    // Time from first sale to first milestone, internal excluded.
    commandDb.$queryRaw<{ median_days: number | null; p75_days: number | null; n: bigint }[]>`
      WITH first_txn AS (
        SELECT e."agencyId", MIN(e."occurredAt") AS first_txn_at
        FROM "Event" e JOIN "Agency" a ON a.id = e."agencyId"
        WHERE e.type = 'transaction_created' AND e."occurredAt" >= ${since90}
          AND e."agencyId" IS NOT NULL AND a."isInternal" = false
        GROUP BY e."agencyId"
      ),
      first_ms AS (
        SELECT "agencyId", MIN("occurredAt") AS first_ms_at FROM "Event"
        WHERE type = 'milestone_confirmed' AND "agencyId" IS NOT NULL GROUP BY "agencyId"
      )
      SELECT
        PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fm.first_ms_at - ft.first_txn_at)) / 86400) AS median_days,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (fm.first_ms_at - ft.first_txn_at)) / 86400) AS p75_days,
        COUNT(*) AS n
      FROM first_txn ft INNER JOIN first_ms fm ON fm."agencyId" = ft."agencyId"
      WHERE fm.first_ms_at > ft.first_txn_at
    `,
  ]);

  const ttft = ttftRows[0] ?? { median_days: null, p75_days: null, p90_days: null, n: BigInt(0) };
  const ttfm = ttfmRows[0] ?? { median_days: null, p75_days: null, n: BigInt(0) };

  // Which agencies ever reached each step — two event reads, then everything is
  // set intersection in JS (per-cohort, per-bucket).
  const cohortIds = agencies.map((a) => a.id);
  const [saleEvents, msEvents] = cohortIds.length === 0
    ? [[] as { agencyId: string | null }[], [] as { agencyId: string | null }[]]
    : await Promise.all([
        commandDb.event.findMany({ where: { type: "transaction_created", agencyId: { in: cohortIds } }, select: { agencyId: true }, distinct: ["agencyId"] }),
        commandDb.event.findMany({ where: { type: "milestone_confirmed", agencyId: { in: cohortIds } }, select: { agencyId: true }, distinct: ["agencyId"] }),
      ]);
  const saleSet = new Set(saleEvents.map((e) => e.agencyId));
  const msSet = new Set(msEvents.map((e) => e.agencyId));

  const totalAgencies = agencies.length;
  const saleN = agencies.filter((a) => saleSet.has(a.id)).length;
  const msN = agencies.filter((a) => msSet.has(a.id)).length;
  const activationRate = totalAgencies > 0 ? saleN / totalAgencies : 0;
  const milestoneRate = totalAgencies > 0 ? msN / totalAgencies : 0;

  // Lifetime cohort funnel (a real, monotonic funnel).
  const funnel = [
    { label: "Joined", n: totalAgencies },
    { label: "Started a sale", n: saleN },
    { label: "Confirmed a milestone", n: msN },
  ];
  // Biggest drop-off between consecutive steps.
  let bottleneck: { from: string; to: string; dropPct: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const prevN = funnel[i - 1].n;
    if (prevN === 0) continue;
    const dropPct = Math.round(((prevN - funnel[i].n) / prevN) * 100);
    if (!bottleneck || dropPct > bottleneck.dropPct) bottleneck = { from: funnel[i - 1].label, to: funnel[i].label, dropPct };
  }

  // Recent-joiner cohort funnel (last 30 days).
  const recent = agencies.filter((a) => a.createdAt >= since30);
  const recentFunnel = [
    { label: "Joined", n: recent.length },
    { label: "Started a sale", n: recent.filter((a) => saleSet.has(a.id)).length },
    { label: "Confirmed a milestone", n: recent.filter((a) => msSet.has(a.id)).length },
  ];

  // Cohort buckets by join age.
  const bucketOf = (from: Date, to: Date) => agencies.filter((a) => a.createdAt >= from && a.createdAt < to);
  const cohortBuckets = [
    { label: "Last 7 days", set: bucketOf(since7, now) },
    { label: "8 to 30 days ago", set: bucketOf(since30, since7) },
    { label: "31 to 90 days ago", set: bucketOf(since90, since30) },
  ].map((b) => ({
    label: b.label,
    total: b.set.length,
    txn: b.set.filter((a) => saleSet.has(a.id)).length,
    ms: b.set.filter((a) => msSet.has(a.id)).length,
  }));

  // 30-day volume (for the new-signups delta + day-by-day).
  const rows30 = txRows30.map((r) => {
    const ur = userRows30.find((u) => u.date.getTime() === r.date.getTime());
    return { ...r, signups: ur?.signups ?? 0, logins: ur?.logins ?? 0, uniqueActiveUsers: ur?.uniqueActiveUsers ?? 0 };
  });
  const sumField = <T,>(rows: T[], field: keyof T) => rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);
  const signups30 = sumField(userRows30, "signups");
  const signups60 = sumField(userRows60, "signups");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Getting started</h1>
      <p className="text-sm text-neutral-400 -mt-4">Are new sign-ups reaching their first real actions, and where do they get stuck?</p>

      {/* Activation headline */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Activation health
          <InfoTip label="What activation means">
            &ldquo;Activated&rdquo; = a joined agency has started a real sale. Rates are across every real customer agency in
            scope (test and demo agencies excluded). Small counts, so read rates alongside the numbers behind them.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="New sign-ups (30d)"
            value={signups30.toLocaleString()}
            sub={<span className={pctColor(signups30, signups60)}>{pctChange(signups30, signups60)} vs prev 30d</span>}
            tip="Agencies that joined in the last 30 days."
          />
          <StatCard
            label="Activation rate"
            value={totalAgencies > 0 ? `${Math.round(activationRate * 100)}%` : "—"}
            valueClass={rateColor(activationRate)}
            sub={`${saleN} of ${totalAgencies} started a sale`}
            tip="Share of agencies that have started at least one real sale."
          />
          <StatCard
            label="Milestone rate"
            value={totalAgencies > 0 ? `${Math.round(milestoneRate * 100)}%` : "—"}
            valueClass={rateColor(milestoneRate)}
            sub={`${msN} of ${totalAgencies} confirmed a milestone`}
            tip="Share of agencies that have confirmed at least one milestone. The deeper activation signal."
          />
          <StatCard
            label="Time to first sale"
            value={fmtDays(ttft.median_days)}
            sub={`median · ${Number(ttft.n)} agenc${Number(ttft.n) === 1 ? "y" : "ies"}`}
            tip="Median days from joining to the first sale (last 90 days of joiners). A tiny or seeded sample can read 0h, so check the count."
          />
          <StatCard
            label="Time to first milestone"
            value={fmtDays(ttfm.median_days)}
            sub={`median · ${Number(ttfm.n)} agenc${Number(ttfm.n) === 1 ? "y" : "ies"}`}
            tip="Median days from the first sale to the first confirmed milestone."
          />
        </div>
      </section>

      {/* The activation funnel + bottleneck */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          The activation funnel
          <InfoTip label="How to read it">
            Of every agency in scope, how many reached each step. A real funnel: each step is a subset of the one above,
            so the fall between steps is where agencies get stuck.
          </InfoTip>
        </h2>
        {bottleneck && bottleneck.dropPct > 0 && (
          <p className="text-[12px] mb-3">
            <span className="text-amber-400 font-semibold">Biggest drop-off:</span>{" "}
            <span className="text-neutral-300">{bottleneck.from} → {bottleneck.to}</span>{" "}
            <span className="text-neutral-500">· {bottleneck.dropPct}% of agencies fall away here.</span>
          </p>
        )}
        {totalAgencies === 0 ? (
          <p className="text-sm text-neutral-600">No agencies in scope.</p>
        ) : (
          <FunnelTable steps={funnel} />
        )}
      </section>

      {/* Recent joiners funnel */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Where recent sign-ups fall away
        </h2>
        <p className="text-[11px] text-neutral-600 mb-3">
          Of the {recent.length} {recent.length === 1 ? "agency" : "agencies"} that joined in the last 30 days.
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-600">No new agencies in the last 30 days.</p>
        ) : (
          <FunnelTable steps={recentFunnel} />
        )}
      </section>

      {/* Time-to-X detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimeToCard
          title="How long until a new agency starts their first sale"
          rows={[{ label: "Half within", v: ttft.median_days }, { label: "3 in 4 within", v: ttft.p75_days }, { label: "9 in 10 within", v: ttft.p90_days }]}
          n={Number(ttft.n)}
        />
        <TimeToCard
          title="How long until they confirm their first milestone"
          rows={[{ label: "Half within", v: ttfm.median_days }, { label: "3 in 4 within", v: ttfm.p75_days }]}
          n={Number(ttfm.n)}
        />
      </div>

      {/* Cohort buckets */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          What new agencies do first, by when they joined
          <InfoTip label="Reading this">
            Older cohorts have had more time, so their rates should be higher. If a rate drops sharply from one step to the
            next (e.g. many start a sale but few confirm a milestone), that step is the bottleneck.
          </InfoTip>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Agencies</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Started a sale</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Sale rate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Confirmed a milestone</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Milestone rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {cohortBuckets.map((b) => {
                const txnRate = b.total > 0 ? b.txn / b.total : 0;
                const msRate = b.total > 0 ? b.ms / b.total : 0;
                return (
                  <tr key={b.label} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-neutral-300">{b.label}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-200 font-medium">{b.total}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{b.txn}</td>
                    <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${b.total > 0 ? rateColor(txnRate) : "text-neutral-600"}`}>{b.total > 0 ? `${Math.round(txnRate * 100)}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{b.ms}</td>
                    <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${b.total > 0 ? rateColor(msRate) : "text-neutral-600"}`}>{b.total > 0 ? `${Math.round(msRate * 100)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Day-by-day */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Day by day, last 30 days
          <InfoTip label="What this is">Raw platform activity per day (same data as the Today page), for context under the activation picture above.</InfoTip>
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

// ── components ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, tip, valueClass = "text-white" }: { label: string; value: string; sub: React.ReactNode; tip?: string; valueClass?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
      <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">{label}{tip && <InfoTip label={label}>{tip}</InfoTip>}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-xs tabular-nums mt-0.5 text-neutral-500">{sub}</p>
    </div>
  );
}

function FunnelTable({ steps }: { steps: { label: string; n: number }[] }) {
  const base = steps[0].n;
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
      {steps.map((step, i) => {
        const barPct = base > 0 ? (step.n / base) * 100 : 0;
        const dropPct = i > 0 && steps[i - 1].n > 0 ? Math.round(((steps[i - 1].n - step.n) / steps[i - 1].n) * 100) : null;
        return (
          <div key={step.label} className="px-5 py-3 flex items-center gap-3">
            <div className="w-44 shrink-0"><p className="text-xs text-neutral-300">{step.label}</p></div>
            <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-[#FF6B4A]/60" style={{ width: `${barPct.toFixed(1)}%` }} />
            </div>
            <span className="text-sm font-bold text-white tabular-nums w-10 text-right shrink-0">{step.n}</span>
            <span className="text-xs tabular-nums w-10 text-right shrink-0 text-neutral-400">{base > 0 ? `${Math.round(barPct)}%` : "—"}</span>
            <span className="text-[11px] tabular-nums w-16 text-right shrink-0 text-red-400">{dropPct != null && dropPct > 0 ? `−${dropPct}%` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function TimeToCard({ title, rows, n }: { title: string; rows: { label: string; v: number | null }[]; n: number }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">{title}</h2>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
        {rows.map(({ label, v }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">{label}</span>
            <span className="text-sm font-bold text-white tabular-nums">{fmtDays(v)}</span>
          </div>
        ))}
        <p className="text-[11px] text-neutral-600 pt-1 border-t border-neutral-800">
          {n === 0 ? "No event data yet." : `Based on ${n} agenc${n === 1 ? "y" : "ies"}. A small or seeded sample can read 0h.`}
        </p>
      </div>
    </section>
  );
}

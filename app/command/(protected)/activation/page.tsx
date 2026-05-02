import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope, modeProfileScope } from "@/lib/command/scope";

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
  if (prev === 0 || curr === prev) return "text-white/30";
  return curr > prev ? "text-emerald-400" : "text-red-400";
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

  const [txRows30, txRows60, userRows30, userRows60] = await Promise.all([
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
  ]);

  // Merge rows for the day-by-day table (join by date)
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

  // Funnel rates (signup as base)
  const funnelRate = (n: number) =>
    curr.signups === 0 ? "—" : `${Math.round((n / curr.signups) * 100)}%`;

  const summaryCards = [
    { label: "Signups",          curr: curr.signups,           prev: prev.signups },
    { label: "Logins",           curr: curr.logins,            prev: prev.logins },
    { label: "Unique actives",   curr: curr.uniqueActiveUsers, prev: prev.uniqueActiveUsers },
    { label: "Txns created",     curr: curr.txnsCreated,       prev: prev.txnsCreated },
    { label: "Milestones conf.", curr: curr.milestones,        prev: prev.milestones },
  ];

  return (
    <div className="space-y-8">

      {/* 30-day summary vs prior 30 */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Last 30 days vs prior 30 days
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {summaryCards.map((c) => (
            <div key={c.label} className="glass-card rounded-2xl px-4 py-4">
              <p className="text-xs text-white/50 mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{c.curr.toLocaleString()}</p>
              <p className={`text-xs tabular-nums mt-0.5 ${pctColor(c.curr, c.prev)}`}>
                {pctChange(c.curr, c.prev)} vs prev 30d
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Activation funnel */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Activation funnel — last 30 days (base: signups)
        </h2>
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40">Stage</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-white/40">Count</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-white/40">% of signups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {[
                { label: "Signups",              n: curr.signups           },
                { label: "Logins (any)",         n: curr.logins            },
                { label: "Unique active users",  n: curr.uniqueActiveUsers },
                { label: "Created a transaction",n: curr.txnsCreated       },
                { label: "Confirmed a milestone",n: curr.milestones        },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3 text-white/70 text-xs">{row.label}</td>
                  <td className="px-5 py-3 text-right text-white tabular-nums text-xs font-medium">
                    {row.n.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-white/50 tabular-nums text-xs">
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
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Day-by-day — last 30 days
        </h2>
        {rows30.length === 0 ? (
          <p className="text-sm text-white/30">No rollup data yet. Cron runs nightly.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/40 whitespace-nowrap">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Signups</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Logins</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Actives</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Txns</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows30.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-white/60 whitespace-nowrap">{fmtDay(r.date)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/80">{r.signups}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{r.logins}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{r.uniqueActiveUsers}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{r.transactionsCreated}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{r.milestonesConfirmed}</td>
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

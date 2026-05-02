import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, serviceTypeScope } from "@/lib/command/scope";

function weekLabel(d: Date): string {
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  const dow = day.getUTCDay();
  const diff = (dow === 0 ? -6 : 1 - dow);
  day.setUTCDate(day.getUTCDate() + diff);
  return day.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

type DailyRow = Awaited<ReturnType<typeof commandDb.dailyMetric.findMany>>[0];

function sumField(rows: DailyRow[], field: keyof DailyRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
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

  const now = new Date();
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);

  const [globalRows, byServiceType, byModeProfile] = await Promise.all([
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
  ]);

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

  const stMap = new Map<string, DailyRow[]>();
  for (const row of byServiceType) {
    const key = row.serviceType ?? "unknown";
    const arr = stMap.get(key) ?? [];
    arr.push(row);
    stMap.set(key, arr);
  }

  const mpMap = new Map<string, DailyRow[]>();
  for (const row of byModeProfile) {
    const key = row.modeProfile ?? "unknown";
    const arr = mpMap.get(key) ?? [];
    arr.push(row);
    mpMap.set(key, arr);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Growth</h1>

      {/* Weekly growth trend */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Weekly trend — last 90 days (w/c Monday)
        </h2>
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

      {/* Breakdown by service type */}
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

    </div>
  );
}

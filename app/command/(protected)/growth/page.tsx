import { commandDb } from "@/lib/command/prisma";

function weekLabel(d: Date): string {
  // ISO week: group by Monday of that week
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  const dow = day.getUTCDay(); // 0=Sun
  const diff = (dow === 0 ? -6 : 1 - dow);
  day.setUTCDate(day.getUTCDate() + diff);
  return day.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

type DailyRow = Awaited<ReturnType<typeof commandDb.dailyMetric.findMany>>[0];

function sumField(rows: DailyRow[], field: keyof DailyRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

export default async function GrowthPage() {
  const now = new Date();
  const since90 = new Date(now);
  since90.setUTCDate(since90.getUTCDate() - 90);
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);

  const [globalRows, byServiceType, byModeProfile] = await Promise.all([
    // Global (no agency/service/mode scope)
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since90 }, agencyId: null, serviceType: null, modeProfile: null },
      orderBy: { date: "asc" },
    }),
    // By service type
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30 }, agencyId: null, serviceType: { not: null }, modeProfile: null },
      orderBy: { date: "asc" },
    }),
    // By mode profile
    commandDb.dailyMetric.findMany({
      where: { date: { gte: since30 }, agencyId: null, serviceType: null, modeProfile: { not: null } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Group daily rows into ISO weeks
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
  const weeklyRows = Array.from(weekMap.values()).reverse(); // most recent first

  // Service type breakdown
  const stMap = new Map<string, DailyRow[]>();
  for (const row of byServiceType) {
    const key = row.serviceType ?? "unknown";
    const arr = stMap.get(key) ?? [];
    arr.push(row);
    stMap.set(key, arr);
  }

  // Mode profile breakdown
  const mpMap = new Map<string, DailyRow[]>();
  for (const row of byModeProfile) {
    const key = row.modeProfile ?? "unknown";
    const arr = mpMap.get(key) ?? [];
    arr.push(row);
    mpMap.set(key, arr);
  }

  return (
    <div className="space-y-8">

      {/* Weekly growth trend */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Weekly trend — last 90 days (w/c Monday)
        </h2>
        {weeklyRows.length === 0 ? (
          <p className="text-sm text-white/30">No rollup data yet. Cron runs nightly.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-white/40">Week</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Signups</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Txns created</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Milestones</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Chases sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {weeklyRows.map((w) => (
                    <tr key={w.week} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-white/60 whitespace-nowrap">{w.week}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/80 font-medium">{w.signups}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{w.txns}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{w.milestones}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{w.chases}</td>
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
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
            By service type — last 30 days
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-white/40">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Signups</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Txns</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Milestones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stMap.size === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-4 text-xs text-white/30">No data yet.</td></tr>
                ) : (
                  Array.from(stMap.entries()).map(([st, rows]) => (
                    <tr key={st}>
                      <td className="px-5 py-2.5 text-xs text-white/70 capitalize">{st.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/70">{sumField(rows, "signups")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{sumField(rows, "transactionsCreated")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{sumField(rows, "milestonesConfirmed")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
            By mode profile — last 30 days
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-white/40">Mode</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Signups</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Txns</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Milestones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mpMap.size === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-4 text-xs text-white/30">No data yet.</td></tr>
                ) : (
                  Array.from(mpMap.entries()).map(([mp, rows]) => (
                    <tr key={mp}>
                      <td className="px-5 py-2.5 text-xs text-white/70 capitalize">{mp.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/70">{sumField(rows, "signups")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{sumField(rows, "transactionsCreated")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/60">{sumField(rows, "milestonesConfirmed")}</td>
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

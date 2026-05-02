import { commandDb } from "@/lib/command/prisma";

function fmtWeek(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function pct(n: number, base: number): string {
  if (base === 0) return "—";
  return `${Math.round((n / base) * 100)}%`;
}

function pctColor(n: number, base: number): string {
  if (base === 0) return "text-white/30";
  const r = n / base;
  if (r >= 0.6) return "text-emerald-400";
  if (r >= 0.3) return "text-amber-400";
  return "text-red-400";
}

export default async function RetentionPage() {
  const cohorts = await commandDb.weeklyCohort.findMany({
    orderBy: { signupWeek: "desc" },
    take: 24, // last 24 weeks
  });

  // Group by modeProfile for summary
  const modeGroups = new Map<string, typeof cohorts>();
  for (const c of cohorts) {
    const key = c.modeProfile;
    const arr = modeGroups.get(key) ?? [];
    arr.push(c);
    modeGroups.set(key, arr);
  }

  // Latest 4 cohorts per mode for the spotlight
  const latestCohorts = cohorts.slice(0, 4);

  return (
    <div className="space-y-8">

      {/* Latest cohort spotlight */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Latest cohorts — retention at each interval
        </h2>
        {latestCohorts.length === 0 ? (
          <p className="text-sm text-white/30">No cohort data yet. Cron runs nightly.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latestCohorts.map((c) => (
              <div key={c.id} className="glass-card rounded-2xl px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white/70">w/c {fmtWeek(c.signupWeek)}</p>
                    <p className="text-[11px] text-white/35 capitalize">{c.modeProfile.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{c.cohortSize}</p>
                    <p className="text-[10px] text-white/30">cohort size</p>
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
                      <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold tabular-nums ${pctColor(n, c.cohortSize)}`}>
                        {pct(n, c.cohortSize)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Full cohort table */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          All cohorts — last 24 weeks
        </h2>
        {cohorts.length === 0 ? (
          <p className="text-sm text-white/30">No cohort data yet.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/40 whitespace-nowrap">Signup week</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Mode</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Size</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Wk 1</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Wk 2</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Wk 4</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Wk 8</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/40">Wk 12</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-white/60 whitespace-nowrap">{fmtWeek(c.signupWeek)}</td>
                      <td className="px-4 py-2.5 text-xs text-white/50 capitalize">{c.modeProfile.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white/70">{c.cohortSize}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${pctColor(c.activeWeek1, c.cohortSize)}`}>{pct(c.activeWeek1, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${pctColor(c.activeWeek2, c.cohortSize)}`}>{pct(c.activeWeek2, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${pctColor(c.activeWeek4, c.cohortSize)}`}>{pct(c.activeWeek4, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${pctColor(c.activeWeek8, c.cohortSize)}`}>{pct(c.activeWeek8, c.cohortSize)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${pctColor(c.activeWeek12, c.cohortSize)}`}>{pct(c.activeWeek12, c.cohortSize)}</td>
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

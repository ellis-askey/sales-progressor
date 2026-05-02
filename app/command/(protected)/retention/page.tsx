import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, cohortModeFilter } from "@/lib/command/scope";

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
  if (base === 0) return "text-neutral-600";
  const r = n / base;
  if (r >= 0.6) return "text-emerald-400";
  if (r >= 0.3) return "text-amber-400";
  return "text-red-400";
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  parseAgencies(sp.agency);

  const cohortFilter = cohortModeFilter(mode);

  const cohorts = await commandDb.weeklyCohort.findMany({
    where: cohortFilter,
    orderBy: { signupWeek: "desc" },
    take: 24,
  });

  const latestCohorts = cohorts.slice(0, 4);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Retention</h1>

      {/* Latest cohort spotlight */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Latest cohorts — retention at each interval
        </h2>
        {latestCohorts.length === 0 ? (
          <p className="text-sm text-neutral-600">No cohort data yet. Cron runs nightly.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          All cohorts — last 24 weeks
        </h2>
        {cohorts.length === 0 ? (
          <p className="text-sm text-neutral-600">No cohort data yet.</p>
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

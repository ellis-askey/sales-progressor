import { commandDb } from "@/lib/command/prisma";

function fmtTs(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function duration(start: Date, end: Date | null): string {
  if (!end) return "running…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export default async function HealthPage() {
  const since7 = new Date();
  since7.setUTCDate(since7.getUTCDate() - 7);

  const [allJobs, recentRuns, deployments] = await Promise.all([
    commandDb.$queryRaw<Array<{
      jobName: string;
      lastRunAt: Date;
      lastSuccess: boolean | null;
      totalRuns: bigint;
      failedRuns: bigint;
    }>>`
      SELECT
        "jobName",
        MAX("startedAt") AS "lastRunAt",
        BOOL_AND("success") FILTER (WHERE "startedAt" = (
          SELECT MAX(jr2."startedAt") FROM "JobRun" jr2 WHERE jr2."jobName" = "JobRun"."jobName"
        )) AS "lastSuccess",
        COUNT(*) AS "totalRuns",
        COUNT(*) FILTER (WHERE "success" = false) AS "failedRuns"
      FROM "JobRun"
      WHERE "startedAt" >= ${since7}
      GROUP BY "jobName"
      ORDER BY "lastRunAt" DESC
    `,
    commandDb.jobRun.findMany({
      where: { startedAt: { gte: since7 } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    commandDb.deployment.findMany({
      orderBy: { deployedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Health</h1>

      {/* Job health summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Cron job health — last 7 days
        </h2>
        {allJobs.length === 0 ? (
          <p className="text-sm text-neutral-600">No job runs recorded yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Job</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-neutral-500">Last status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Last run</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Runs</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {allJobs.map((j) => (
                  <tr key={j.jobName} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-neutral-300">{j.jobName}</td>
                    <td className="px-4 py-3 text-center">
                      {j.lastSuccess === null ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500">unknown</span>
                      ) : j.lastSuccess ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">ok</span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-900">failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-400 whitespace-nowrap">{fmtTs(j.lastRunAt)}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-neutral-300">{Number(j.totalRuns)}</td>
                    <td className={`px-4 py-3 text-right text-xs tabular-nums ${Number(j.failedRuns) > 0 ? "text-red-400" : "text-neutral-600"}`}>
                      {Number(j.failedRuns)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent individual runs */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Recent runs — last 50
        </h2>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-neutral-600">No runs yet.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            {recentRuns.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                  r.success === null ? "bg-neutral-800 text-neutral-500" :
                  r.success ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-red-950 text-red-400 border border-red-900"
                }`}>
                  {r.success === null ? "?" : r.success ? "ok" : "fail"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-neutral-300">{r.jobName}</p>
                  {r.errorMessage && (
                    <p className="text-[10px] text-red-400 truncate mt-0.5">{r.errorMessage}</p>
                  )}
                  {r.rowsWritten != null && (
                    <p className="text-[10px] text-neutral-600 mt-0.5">{r.rowsWritten} rows</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-neutral-500 whitespace-nowrap">{fmtTs(r.startedAt)}</p>
                  <p className="text-[10px] text-neutral-600">{duration(r.startedAt, r.finishedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Deployment history */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Deployment history — last 10
        </h2>
        {deployments.length === 0 ? (
          <p className="text-sm text-neutral-600">No deployments yet. Configure the Vercel webhook to start tracking.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            {deployments.map((d) => (
              <div key={d.id} className="px-5 py-3.5 flex items-start gap-3">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 shrink-0 mt-0.5">
                  {d.environment}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-neutral-300">{d.version}</p>
                  {d.releaseNotes && (
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{d.releaseNotes}</p>
                  )}
                  <p className="text-[10px] text-neutral-600 mt-0.5 capitalize">
                    {d.triggerType}{d.triggeredBy ? ` · ${d.triggeredBy}` : ""}
                  </p>
                </div>
                <span className="text-[10px] text-neutral-500 shrink-0 whitespace-nowrap">{fmtTs(d.deployedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

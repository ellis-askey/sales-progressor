import { commandDb } from "@/lib/command/prisma";
import vercelConfig from "@/vercel.json";
import { cronInfo, CRON_GROUP_ORDER, type CronGroup } from "@/lib/command/cron-info";
import { nextRun } from "@/lib/cron/next-run";
import InfoTip from "@/components/command/shared/InfoTip";

function fmtTs(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Turns a cron expression into something readable. Covers the shapes we use;
// falls back to the raw expression for anything unusual.
function cronToHuman(expr: string): string {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/);
  if (!min || !hour) return expr;
  const at = hour !== "*" && min !== "*" ? `${hour.padStart(2, "0")}:${min.padStart(2, "0")}` : null;
  if (hour === "*") return min === "0" ? "Every hour" : `Every hour at :${min}`;
  if (dom === "*" && mon === "*") {
    if (dow === "*") return `Daily ${at} UTC`;
    if (dow.includes("-")) {
      const [a, b] = dow.split("-").map((n) => DOW[Number(n)] ?? n);
      return `${a}–${b} ${at} UTC`;
    }
    const day = DOW[Number(dow)] ?? dow;
    return `${day} ${at} UTC`;
  }
  return expr;
}

// The scheduled cron jobs are the source of truth in vercel.json. The Health
// page cross-references them against JobRun rows so untracked jobs are visible
// rather than silently missing.
const SCHEDULED_JOBS: { name: string; schedule: string }[] = (vercelConfig.crons ?? [])
  .map((c: { path: string; schedule: string }) => ({
    name: c.path.split("/").pop() ?? c.path,
    schedule: c.schedule,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

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

  // Loosely match each scheduled cron to any JobRun stats that report in (job
  // names aren't identical to paths — e.g. "rollup-metrics" ↔ "rollup-metrics-nightly").
  const findStat = (name: string) =>
    allJobs.find((j) => j.jobName === name || j.jobName.includes(name) || name.includes(j.jobName)) ?? null;

  const now = new Date();
  const scheduled = SCHEDULED_JOBS.map((job) => {
    const info = cronInfo(job.name);
    return { ...job, stat: findStat(job.name), info, nextRunAt: nextRun(job.schedule, now) };
  });
  const reportingCount = scheduled.filter((s) => s.stat).length;
  const failing = scheduled.filter((s) => s.stat?.lastSuccess === false).length;

  // Group jobs by category, preserving the defined group order.
  const byGroup = new Map<CronGroup, typeof scheduled>();
  for (const g of CRON_GROUP_ORDER) byGroup.set(g, []);
  for (const s of scheduled) {
    const arr = byGroup.get(s.info.group) ?? [];
    arr.push(s);
    byGroup.set(s.info.group, arr);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">System status</h1>
        <p className="text-sm text-neutral-400 mt-1">
          The {scheduled.length} background jobs that keep the platform running, what each one does, when it last ran, and when it&rsquo;s next due.
        </p>
        <p className="text-[12px] text-neutral-600 mt-1">
          {failing > 0 ? (
            <span className="text-red-400">{failing} job{failing > 1 ? "s" : ""} failed on its last run. </span>
          ) : (
            <span className="text-emerald-400/80">No failures on the last run. </span>
          )}
          {reportingCount} of {scheduled.length} report a live status; the rest run on schedule but don&rsquo;t log a result yet.
        </p>
      </div>

      {/* Scheduled jobs, grouped */}
      {CRON_GROUP_ORDER.map((group) => {
        const jobs = byGroup.get(group) ?? [];
        if (jobs.length === 0) return null;
        return (
          <section key={group}>
            <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">{group}</h2>
            <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-neutral-950/60">
                    <th className="text-left px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Job</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Schedule</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Last status</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Last run</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Next run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {jobs.map((j) => (
                    <tr key={j.name} className="hover:bg-neutral-950/40 transition-colors align-top">
                      <td className="px-5 py-3">
                        <div className="text-xs text-neutral-200 font-medium">{j.info.label}</div>
                        {j.info.desc && <div className="text-[11px] text-neutral-500 mt-0.5 max-w-md leading-relaxed">{j.info.desc}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{cronToHuman(j.schedule)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {!j.stat ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
                            not logged
                            <span className="ml-1 inline-block align-middle"><InfoTip label="Not logged">This job runs on schedule, but it doesn&rsquo;t record whether it succeeded yet, so we can&rsquo;t show a status.</InfoTip></span>
                          </span>
                        ) : j.stat.lastSuccess === false ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-900">failed</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">ok</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-400 whitespace-nowrap">
                        {j.stat ? fmtTs(j.stat.lastRunAt) : <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-500 whitespace-nowrap">{fmtTs(j.nextRunAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

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

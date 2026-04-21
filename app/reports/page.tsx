import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getWeeklyReport } from "@/lib/services/reports";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900/90">{title}</p>
        {count !== undefined && (
          <span className="text-xs font-medium bg-white/30 text-slate-900/60 px-2.5 py-1 rounded-full">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default async function ReportsPage() {
  const session = await requireSession();
  const [report, taskCounts, todoCount] = await Promise.all([
    getWeeklyReport(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const periodLabel = `${report.periodStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${report.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <AppShell session={session} activePath="/reports" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div className="relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}>
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative px-8 pt-6 pb-7">
          <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">Reporting</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Weekly Snapshot</h1>
          <p className="text-sm text-slate-400 mt-0.5">{periodLabel}</p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active files",      value: String(report.totalActiveFiles),   color: "text-emerald-600" },
            { label: "Pipeline value",    value: fmt(report.totalPipelineValue),     color: "text-blue-600" },
            { label: "Milestones (7d)",   value: String(report.milestonesCompleted.length), color: "text-slate-900/90" },
            { label: "Overdue tasks",     value: String(report.overdueTaskCount),   color: report.overdueTaskCount > 0 ? "text-orange-500" : "text-slate-900/90" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card px-5 py-4">
              <p className="text-xs text-slate-900/40 mb-1">{label}</p>
              <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Files exchanged ── */}
        <Section title="Exchanged this week" count={report.filesExchanged.length}>
          {report.filesExchanged.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-900/40 text-center">No exchanges this week</div>
          ) : (
            <div className="divide-y divide-white/15">
              {report.filesExchanged.map((f) => (
                <Link key={f.id} href={`/transactions/${f.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/20 transition-colors group">
                  <span className="text-sm text-slate-900/80 group-hover:text-blue-600 transition-colors">{f.propertyAddress}</span>
                  {f.completionDate && (
                    <span className="text-xs text-slate-900/40 flex-shrink-0 ml-3">
                      Completion: {new Date(f.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* ── Files added ── */}
        <Section title="New files this week" count={report.filesAdded.length}>
          {report.filesAdded.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-900/40 text-center">No new files this week</div>
          ) : (
            <div className="divide-y divide-white/15">
              {report.filesAdded.map((f) => (
                <Link key={f.id} href={`/transactions/${f.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/20 transition-colors group">
                  <span className="text-sm text-slate-900/80 group-hover:text-blue-600 transition-colors">{f.propertyAddress}</span>
                  <span className="text-xs text-slate-900/40 flex-shrink-0 ml-3">
                    {new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* ── Milestones completed ── */}
        <Section title="Milestones completed this week" count={report.milestonesCompleted.length}>
          {report.milestonesCompleted.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-900/40 text-center">No milestones logged this week</div>
          ) : (
            <div className="divide-y divide-white/15">
              {report.milestonesCompleted.map((m, i) => (
                <Link key={i} href={`/transactions/${m.transactionId}`}
                      className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3 hover:bg-white/20 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900/80 group-hover:text-blue-600 transition-colors truncate">{m.propertyAddress}</p>
                    <p className="text-xs text-slate-900/40 mt-0.5">{m.milestoneName}{m.completedByName ? ` · ${m.completedByName}` : ""}</p>
                  </div>
                  <span className="text-xs text-slate-900/40 flex-shrink-0 self-center">
                    {new Date(m.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

      </div>
    </AppShell>
  );
}

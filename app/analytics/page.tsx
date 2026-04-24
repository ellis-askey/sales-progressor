import { requireSession } from "@/lib/session";
import { getAnalytics, getReferralStats } from "@/lib/services/analytics";
import { AppShell } from "@/components/layout/AppShell";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

function BarChart({
  data,
  keys,
  colors,
  height = 120,
}: {
  data: { label: string; values: number[] }[];
  keys: string[];
  colors: string[];
  height?: number;
}) {
  const allValues = data.flatMap((d) => d.values);
  const max = Math.max(...allValues, 1);
  const barW = Math.max(8, Math.floor(500 / (data.length * (keys.length + 0.5))));
  const gap = Math.max(2, Math.floor(barW * 0.3));
  const groupW = keys.length * barW + (keys.length - 1) * gap;
  const groupGap = Math.max(4, barW);
  const totalW = data.length * (groupW + groupGap);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(totalW, 400)} height={height + 32} style={{ display: "block" }}>
        {data.map((d, gi) => {
          const gx = gi * (groupW + groupGap);
          return (
            <g key={gi} transform={`translate(${gx}, 0)`}>
              {d.values.map((v, ki) => {
                const bh = (v / max) * height;
                const bx = ki * (barW + gap);
                return (
                  <g key={ki}>
                    <rect
                      x={bx} y={height - bh} width={barW} height={bh}
                      rx={2} fill={colors[ki]} opacity={0.85}
                    />
                    {v > 0 && (
                      <text x={bx + barW / 2} y={height - bh - 3} textAnchor="middle"
                        fontSize={9} fill="#6b7280" fontFamily="-apple-system, sans-serif">
                        {v}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={groupW / 2} y={height + 18} textAnchor="middle"
                fontSize={9} fill="#9ca3af" fontFamily="-apple-system, sans-serif">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        {keys.map((k, i) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: colors[i] }} />
            <span className="text-xs text-slate-900/40">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "text-slate-900/90" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="glass-card px-5 py-4">
      <p className="text-xs text-slate-900/40 mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-900/40 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await requireSession();
  const [data, referralStats, taskCounts, todoCount] = await Promise.all([
    getAnalytics(session.user.agencyId),
    getReferralStats(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const chartData = data.monthlyVolume.map((m) => ({
    label: m.month,
    values: [m.created, m.exchanged, m.completed],
  }));

  return (
    <AppShell session={session} activePath="/analytics" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      {/* Header */}
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">Reporting</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">{session.user.name} · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active files" value={String(data.totalActive)} color="text-emerald-600" />
          <StatCard label="Pipeline value" value={fmt(data.pipelineValue)} sub="across active files" color="text-blue-600" />
          <StatCard
            label="Avg days to exchange"
            value={data.avgDaysToExchange !== null ? `${data.avgDaysToExchange}d` : "—"}
            sub={data.avgDaysToExchange !== null ? "from instruction" : "no exchanges yet"}
          />
          <StatCard
            label="Completion rate"
            value={data.conversionRate !== null ? `${data.conversionRate}%` : "—"}
            sub={`${data.totalCompleted} completed · ${data.totalWithdrawn} withdrawn`}
          />
        </div>

        {/* ── Fee pipeline ── */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Our fees pipeline"
            value={fmt(data.ourFeesPipeline)}
            sub={`across ${data.ourFeesTxCount} file${data.ourFeesTxCount !== 1 ? "s" : ""} with fee set`}
            color="text-violet-600"
          />
          <StatCard
            label="Agent fees pipeline"
            value={data.agentFeesTxCount > 0 ? fmt(data.agentFeesPipeline) : "—"}
            sub={data.agentFeesTxCount > 0 ? `across ${data.agentFeesTxCount} file${data.agentFeesTxCount !== 1 ? "s" : ""} with fee set` : "no agent fees set"}
            color="text-orange-600"
          />
        </div>

        {/* ── Monthly volume chart ── */}
        <div className="glass-card px-5 py-5">
          <p className="text-sm font-semibold text-slate-900/90 mb-1">Monthly activity</p>
          <p className="text-xs text-slate-900/40 mb-5">Files created, exchanged, and completed — last 12 months</p>
          <BarChart
            data={chartData}
            keys={["Created", "Exchanged", "Completed"]}
            colors={["#93c5fd", "#3b82f6", "#10b981"]}
            height={130}
          />
        </div>

        {/* ── Progressor breakdown ── */}
        <div className="glass-card">
          <div className="px-5 py-4 border-b border-white/20">
            <p className="text-sm font-semibold text-slate-900/90">Files by progressor</p>
          </div>
          {data.progressorStats.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-900/40">No data yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-900/40 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Progressor</th>
                  <th className="px-5 py-3 text-right font-medium">Active</th>
                  <th className="px-5 py-3 text-right font-medium">Completed</th>
                  <th className="px-5 py-3 text-right font-medium">Pipeline value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {data.progressorStats.map((p) => (
                  <tr key={p.name} className="hover:bg-white/20">
                    <td className="px-5 py-3.5 font-medium text-slate-900/80">{p.name}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50/60 text-emerald-700">
                        {p.active}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-900/50">{p.completed}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-900/80">
                      {p.pipelineValue > 0 ? fmt(p.pipelineValue) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── File status breakdown ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active",    value: data.totalActive,    color: "bg-emerald-500" },
            { label: "Completed", value: data.totalCompleted, color: "bg-blue-500" },
            { label: "Withdrawn", value: data.totalWithdrawn, color: "bg-slate-400" },
          ].map(({ label, value, color }) => {
            const total = data.totalActive + data.totalCompleted + data.totalWithdrawn;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div key={label} className="glass-card px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <p className="text-xs font-medium text-slate-900/50">{label}</p>
                </div>
                <p className="text-3xl font-bold text-slate-900/90">{value}</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-900/8 overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-900/40 mt-1">{pct}% of all files</p>
              </div>
            );
          })}
        </div>

        {/* ── Referral income ── */}
        {referralStats.length > 0 && (
          <div className="glass-card">
            <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900/90">Referral income</p>
                <p className="text-xs text-slate-900/40 mt-0.5">Conveyancer recommendations and fee tracking</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-600">
                  {fmt(referralStats.reduce((s, r) => s + r.feeReceivedPence, 0))}
                </p>
                <p className="text-xs text-slate-900/40">received</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-900/40 uppercase tracking-wide border-b border-white/10">
                  <th className="px-5 py-3 text-left font-medium">Firm</th>
                  <th className="px-5 py-3 text-right font-medium">Referrals</th>
                  <th className="px-5 py-3 text-right font-medium">Expected</th>
                  <th className="px-5 py-3 text-right font-medium">Received</th>
                  <th className="px-5 py-3 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {referralStats.map((r) => {
                  const pending = r.feeExpectedPence - r.feeReceivedPence;
                  return (
                    <tr key={r.firmId} className="hover:bg-white/20">
                      <td className="px-5 py-3.5 font-medium text-slate-900/80">{r.firmName}</td>
                      <td className="px-5 py-3.5 text-right text-slate-900/60">{r.referralCount}</td>
                      <td className="px-5 py-3.5 text-right text-slate-900/60">
                        {r.feeExpectedPence > 0 ? fmt(r.feeExpectedPence) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-emerald-600">
                        {r.feeReceivedPence > 0 ? fmt(r.feeReceivedPence) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {pending > 0 ? (
                          <span className="text-amber-600 font-medium">{fmt(pending)}</span>
                        ) : (
                          <span className="text-slate-900/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </AppShell>
  );
}

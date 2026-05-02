import { prisma } from "@/lib/prisma";

function fmtDelta(v: number): string {
  return v >= 0 ? `+${v}%` : `${v}%`;
}

function deltaColor(v: number, positiveIsGood = true): string {
  if (v === 0) return "text-white/40";
  const isGood = positiveIsGood ? v > 0 : v < 0;
  return isGood ? "text-emerald-400" : "text-red-400";
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const SEVERITY_BADGE: Record<string, string> = {
  critical:    "bg-red-500/20 text-red-300",
  leak:        "bg-amber-500/20 text-amber-300",
  opportunity: "bg-emerald-500/20 text-emerald-300",
  info:        "bg-white/10 text-white/50",
};

export default async function CommandCentreOverviewPage() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const [
    currentMetrics,
    previousMetrics,
    signalCounts,
    unacknowledgedSignals,
    activeExperimentsCount,
    proposedExperimentsCount,
    lastDeployment,
  ] = await Promise.all([
    // Current 7-day global sums
    prisma.dailyMetric.aggregate({
      where: { date: { gte: weekAgo, lte: now }, agencyId: null, serviceType: null, modeProfile: null },
      _sum: { signups: true, transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
      _avg: { uniqueActiveUsers: true },
    }),
    // Previous 7-day global sums (for delta)
    prisma.dailyMetric.aggregate({
      where: { date: { gte: twoWeeksAgo, lt: weekAgo }, agencyId: null, serviceType: null, modeProfile: null },
      _sum: { signups: true, transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
      _avg: { uniqueActiveUsers: true },
    }),
    // Signal count by severity (last 7d)
    prisma.signal.groupBy({
      by: ["severity"],
      where: { detectedAt: { gte: weekAgo } },
      _count: { id: true },
    }),
    // Recent unacknowledged signals
    prisma.signal.findMany({
      where: { acknowledged: false },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 5,
    }),
    prisma.experiment.count({ where: { status: "active" } }),
    prisma.experiment.count({ where: { status: "proposed" } }),
    prisma.deployment.findFirst({ orderBy: { deployedAt: "desc" } }),
  ]);

  function pct(curr: number | null, prev: number | null): number {
    if (!prev || prev === 0 || curr === null) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const cs = currentMetrics._sum;
  const ps = previousMetrics._sum;

  const statRows = [
    { label: "New signups",          curr: cs.signups ?? 0,               prev: ps.signups ?? 0,               good: true },
    { label: "Transactions created", curr: cs.transactionsCreated ?? 0,   prev: ps.transactionsCreated ?? 0,   good: true },
    { label: "Milestones confirmed", curr: cs.milestonesConfirmed ?? 0,   prev: ps.milestonesConfirmed ?? 0,   good: true },
    { label: "Chases sent",          curr: cs.chasesSent ?? 0,            prev: ps.chasesSent ?? 0,            good: true },
    { label: "AI drafts generated",  curr: cs.aiDraftsGenerated ?? 0,     prev: ps.aiDraftsGenerated ?? 0,     good: true },
  ];

  const signalByKey = Object.fromEntries(signalCounts.map((r) => [r.severity, r._count.id]));

  return (
    <div className="space-y-8">

      {/* ── 7-day metric summary ── */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Platform — last 7 days vs prior 7 days</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statRows.map((s) => {
            const d = pct(s.curr, s.prev);
            return (
              <div key={s.label} className="glass-card rounded-2xl px-4 py-4">
                <p className="text-xs text-white/50 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white tabular-nums">{s.curr.toLocaleString()}</p>
                <p className={`text-xs tabular-nums mt-0.5 ${deltaColor(d, s.good)}`}>
                  {d !== 0 ? fmtDelta(d) : "no change"} vs prev week
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Signal health ── */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Signal health — last 7 days</h2>
        <div className="flex items-center gap-3 flex-wrap mb-5">
          {(["critical", "leak", "opportunity", "info"] as const).map((sev) => (
            <div key={sev} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${SEVERITY_BADGE[sev]}`}>
              <span className="tabular-nums font-bold">{signalByKey[sev] ?? 0}</span>
              <span className="opacity-70">{sev}</span>
            </div>
          ))}
        </div>

        {unacknowledgedSignals.length > 0 ? (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-white/60">Unacknowledged signals</p>
              <a href="/admin/command-centre/signals" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                View all →
              </a>
            </div>
            <div className="divide-y divide-white/8">
              {unacknowledgedSignals.map((s) => {
                const payload = s.payload as Record<string, unknown>;
                return (
                  <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                      {s.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80">{s.detectorName.replace(/_/g, " ")}</p>
                      <p className="text-xs text-white/40 truncate">
                        {Math.round(s.confidence * 100)}% conf · {fmtDate(s.detectedAt)}
                        {payload.indicator ? ` · ${payload.indicator}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/30">All signals acknowledged.</p>
        )}
      </section>

      {/* ── Experiments + deployments ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Experiments</h2>
          <div className="glass-card rounded-2xl px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Active</span>
              <span className="text-lg font-bold text-white">{activeExperimentsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Proposed</span>
              <span className="text-lg font-bold text-white">{proposedExperimentsCount}</span>
            </div>
            <a href="/admin/command-centre/experiments" className="block mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
              Manage experiments →
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Last deployment</h2>
          <div className="glass-card rounded-2xl px-5 py-4">
            {lastDeployment ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
                    {lastDeployment.environment}
                  </span>
                  <span className="text-xs text-white/40">{fmtDate(lastDeployment.deployedAt)}</span>
                </div>
                <p className="text-xs font-mono text-white/60 truncate">{lastDeployment.version}</p>
                {lastDeployment.releaseNotes && (
                  <p className="text-xs text-white/40 line-clamp-2">{lastDeployment.releaseNotes}</p>
                )}
                <a href="/admin/command-centre/deployments" className="block mt-2 text-xs text-white/40 hover:text-white/70 transition-colors">
                  View history →
                </a>
              </div>
            ) : (
              <p className="text-sm text-white/30">No deployments recorded yet.</p>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}

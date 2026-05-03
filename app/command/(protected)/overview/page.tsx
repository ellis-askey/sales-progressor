import { commandDb } from "@/lib/command/prisma";
import Link from "next/link";
import { parseMode, parseAgencies, serviceTypeScope, modeProfileScope } from "@/lib/command/scope";
import WhatChanged from "@/components/command/shared/WhatChanged";

function fmtDelta(v: number): string {
  return v >= 0 ? `+${v}%` : `${v}%`;
}

function deltaColor(v: number, positiveIsGood = true): string {
  if (v === 0) return "text-neutral-600";
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
  critical:    "bg-red-950 text-red-400 border border-red-900",
  leak:        "bg-amber-950 text-amber-400 border border-amber-900",
  opportunity: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  info:        "bg-neutral-800 text-neutral-400",
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const txScope   = serviceTypeScope(mode, agencyIds);
  const userScope = modeProfileScope(mode, agencyIds);

  const [
    currentTx, previousTx,
    currentUser, previousUser,
    signalCounts, unacknowledgedSignals,
    activeExperimentsCount, proposedExperimentsCount,
    lastDeployment,
  ] = await Promise.all([
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: weekAgo, lte: now }, ...txScope },
      _sum: { transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: twoWeeksAgo, lt: weekAgo }, ...txScope },
      _sum: { transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: weekAgo, lte: now }, ...userScope },
      _sum: { signups: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: twoWeeksAgo, lt: weekAgo }, ...userScope },
      _sum: { signups: true },
    }),
    commandDb.signal.groupBy({
      by: ["severity"],
      where: { detectedAt: { gte: weekAgo } },
      _count: { id: true },
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 5,
    }),
    commandDb.experiment.count({ where: { status: "active" } }),
    commandDb.experiment.count({ where: { status: "proposed" } }),
    commandDb.deployment.findFirst({ orderBy: { deployedAt: "desc" } }),
  ]);

  function pct(curr: number | null, prev: number | null): number {
    if (!prev || prev === 0 || curr === null) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const statRows = [
    { label: "New signups",          metric: "signups",      curr: currentUser._sum.signups ?? 0,              prev: previousUser._sum.signups ?? 0,              good: true },
    { label: "Transactions created", metric: "transactions", curr: currentTx._sum.transactionsCreated ?? 0,   prev: previousTx._sum.transactionsCreated ?? 0,    good: true },
    { label: "Milestones confirmed", metric: "milestones",   curr: currentTx._sum.milestonesConfirmed ?? 0,   prev: previousTx._sum.milestonesConfirmed ?? 0,    good: true },
    { label: "Chases sent",          metric: "chases",       curr: currentTx._sum.chasesSent ?? 0,            prev: previousTx._sum.chasesSent ?? 0,             good: true },
    { label: "AI drafts generated",  metric: "ai_drafts",    curr: currentTx._sum.aiDraftsGenerated ?? 0,     prev: previousTx._sum.aiDraftsGenerated ?? 0,      good: true },
  ];

  const signalByKey = Object.fromEntries(signalCounts.map((r) => [r.severity, r._count.id]));
  const modeLabel = mode === "sp" ? " · SP" : mode === "pm" ? " · PM" : "";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Overview</h1>

      {/* 7-day metric summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Platform{modeLabel} — last 7 days vs prior 7 days
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statRows.map((s) => {
            const d = pct(s.curr, s.prev);
            return (
              <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
                <p className="text-xs text-neutral-400 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white tabular-nums">{s.curr.toLocaleString()}</p>
                <p className={`text-xs tabular-nums mt-0.5 ${deltaColor(d, s.good)}`}>
                  {d !== 0 ? fmtDelta(d) : "no change"} vs prev week
                </p>
                <WhatChanged windowStart={weekAgo} windowEnd={now} metric={s.metric} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Signal health */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Signal health — last 7 days</h2>
        <div className="flex items-center gap-3 flex-wrap mb-5">
          {(["critical", "leak", "opportunity", "info"] as const).map((sev) => (
            <div key={sev} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${SEVERITY_BADGE[sev]}`}>
              <span className="tabular-nums font-bold">{signalByKey[sev] ?? 0}</span>
              <span className="opacity-70">{sev}</span>
            </div>
          ))}
        </div>

        {unacknowledgedSignals.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-300">Unacknowledged signals</p>
              <Link href="/command/insights" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-neutral-800">
              {unacknowledgedSignals.map((s) => {
                const payload = s.payload as Record<string, unknown>;
                return (
                  <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                      {s.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-200">{s.detectorName.replace(/_/g, " ")}</p>
                      <p className="text-xs text-neutral-500 truncate">
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
          <p className="text-sm text-neutral-600">All signals acknowledged.</p>
        )}
      </section>

      {/* Experiments + last deployment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Experiments</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-2">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-sm text-neutral-300">Active</span>
              <span className="text-lg font-bold text-white">{activeExperimentsCount}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-sm text-neutral-300">Proposed</span>
              <span className="text-lg font-bold text-white">{proposedExperimentsCount}</span>
            </div>
            <Link href="/command/experiments" className="block pt-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
              Manage experiments →
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Last deployment</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            {lastDeployment ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                    {lastDeployment.environment}
                  </span>
                  <span className="text-xs text-neutral-500">{fmtDate(lastDeployment.deployedAt)}</span>
                </div>
                <p className="text-xs font-mono text-neutral-300 truncate">{lastDeployment.version}</p>
                {lastDeployment.releaseNotes && (
                  <p className="text-xs text-neutral-500 line-clamp-2">{lastDeployment.releaseNotes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">No deployments yet. Configure the Vercel webhook to start tracking.</p>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}

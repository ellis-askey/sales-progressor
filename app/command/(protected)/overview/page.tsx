import { commandDb } from "@/lib/command/prisma";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { parseMode, parseAgencies, serviceTypeScope, modeProfileScope } from "@/lib/command/scope";
import { computeTodayLive } from "@/lib/command/today-live";
import { londonDateStr } from "@/lib/services/metrics-rollup";
import WhatChanged from "@/components/command/shared/WhatChanged";
import InfoTip from "@/components/command/shared/InfoTip";
import AutoRefresh from "@/components/command/shared/AutoRefresh";

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

function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

const SEVERITY_BADGE: Record<string, string> = {
  critical:    "bg-red-950 text-red-400 border border-red-900",
  leak:        "bg-amber-950 text-amber-400 border border-amber-900",
  opportunity: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  info:        "bg-neutral-800 text-neutral-400",
};

// Live files older than this with no recent milestone are "stuck".
const STUCK_DAYS = 14;
// A draft untouched for longer than this is flagged as going stale.
const STALE_DRAFT_DAYS = 21;

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);

  const now = new Date();

  // Rollup rows are keyed at UTC-midnight of their London date. Align every
  // window boundary to that same key so live "today" stitches cleanly onto the
  // rolled-up history with no overlap and no gap.
  const dayMs = 86_400_000;
  const todayKey = new Date(`${londonDateStr(now)}T00:00:00.000Z`);
  const last7Start = new Date(todayKey.getTime() - 6 * dayMs);        // current window: 6 completed days + today (live)
  const sevenCompletedStart = new Date(todayKey.getTime() - 7 * dayMs); // 7 completed days -> pulse strip + averages
  const prior7Start = new Date(todayKey.getTime() - 13 * dayMs);      // previous window: the 7 days before last7Start
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * dayMs);
  const staleBefore = new Date(now.getTime() - STALE_DRAFT_DAYS * dayMs);

  const txScope   = serviceTypeScope(mode, agencyIds);
  const userScope = modeProfileScope(mode, agencyIds);

  // Shared "stuck file" filter — reused by the count and the list so they agree.
  // Excludes demo, admin-migrated, and internal-agency files to match every
  // other metric on this page, and requires the file to be older than the stuck
  // window so brand-new files with no milestones yet aren't mislabelled.
  const stuckWhere = {
    status: { in: ["active" as const, "on_hold" as const] },
    isDemo: false,
    isMigrated: false,
    agency: { isInternal: false },
    createdAt: { lt: stuckBefore },
    milestoneCompletions: { none: { state: "complete" as const, completedAt: { gte: stuckBefore } } },
  };

  const [
    currentTx, previousTx,
    currentUser, previousUser,
    today,
    signalCounts, unacknowledgedSignals,
    activeExperimentsCount, proposedExperimentsCount,
    dailyRows,
    spWeek, pmWeek,
    stuckCount, stuckList,
    draftRows,
    portalSkipAggregate,
    recentPortalSkippers,
  ] = await Promise.all([
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: last7Start, lt: todayKey }, ...txScope },
      _sum: { transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: prior7Start, lt: last7Start }, ...txScope },
      _sum: { transactionsCreated: true, milestonesConfirmed: true, chasesSent: true, aiDraftsGenerated: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: last7Start, lt: todayKey }, ...userScope },
      _sum: { signups: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: prior7Start, lt: last7Start }, ...userScope },
      _sum: { signups: true },
    }),
    // Today, computed live from the main DB (the nightly rollup only writes
    // yesterday, so a "today" rollup row never exists during the day).
    computeTodayLive(mode, agencyIds),
    // Signal health = situations open right now (living signals: unresolved,
    // not snoozed), not a rolling count of nightly rows.
    commandDb.signal.groupBy({
      by: ["severity"],
      where: { resolvedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] },
      _count: { id: true },
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 5,
    }),
    commandDb.experiment.count({ where: { status: "active" } }),
    commandDb.experiment.count({ where: { status: "proposed" } }),
    // Per-day breakdown (7 completed days) for the pulse strip + averages
    commandDb.dailyMetric.findMany({
      where: { date: { gte: sevenCompletedStart, lt: todayKey }, agencyId: null, serviceType: null, modeProfile: null },
      orderBy: { date: "asc" },
      select: { date: true, milestonesConfirmed: true, transactionsCreated: true, signups: true, chasesSent: true },
    }),
    // SP vs PM weekly split (global roll-ups only)
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: sevenCompletedStart, lt: todayKey }, agencyId: null, serviceType: null, modeProfile: "self_progressed" },
      _sum: { signups: true, transactionsCreated: true, milestonesConfirmed: true, chasesSent: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: sevenCompletedStart, lt: todayKey }, agencyId: null, serviceType: null, modeProfile: "progressor_managed" },
      _sum: { signups: true, transactionsCreated: true, milestonesConfirmed: true, chasesSent: true },
    }),
    // Stuck files — count + the actual list (identical filter).
    prisma.propertyTransaction.count({ where: stuckWhere }),
    prisma.propertyTransaction.findMany({
      where: stuckWhere,
      orderBy: { createdAt: "asc" },
      take: 25,
      select: {
        id: true,
        propertyAddress: true,
        createdAt: true,
        status: true,
        agency: { select: { name: true } },
        assignedUser: { select: { name: true } },
        milestoneCompletions: {
          where: { state: "complete" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),
    // Agent drafts across the platform — used to compute the potential pipeline
    // widget below. Excludes demo + internal-agency files to match the rest of
    // the page. We deduplicate (agencyId, propertyAddress) pairs in JS so case
    // variants of the same address don't double-count, and exclude drafts where
    // the same agency already has a non-draft transaction at that address.
    prisma.propertyTransaction.findMany({
      where: { status: "draft", isDemo: false, agency: { isInternal: false } },
      select: { id: true, propertyAddress: true, agencyId: true, createdAt: true, agency: { select: { name: true } } },
    }),
    // Portal opt-out telemetry.
    prisma.user.aggregate({
      where: { portalInviteSkipCount: { gt: 0 } },
      _sum: { portalInviteSkipCount: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { portalInviteSkipCount: { gt: 0 } },
      orderBy: { lastPortalInviteSkipAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        portalInviteSkipCount: true,
        lastPortalInviteSkipAt: true,
        agency: { select: { name: true } },
      },
    }),
  ]);

  // Second pass: which (agencyId, address) pairs from the draft set are already
  // represented by a non-draft transaction? Those are duplicates of already-
  // realised sales and don't count as "still incoming".
  const draftAgencyIds = Array.from(new Set(draftRows.map((r) => r.agencyId)));
  const realisedRows = draftAgencyIds.length === 0
    ? []
    : await prisma.propertyTransaction.findMany({
        where: { agencyId: { in: draftAgencyIds }, status: { not: "draft" }, isDemo: false, agency: { isInternal: false } },
        select: { propertyAddress: true, agencyId: true },
      });
  const realisedKeys = new Set(
    realisedRows.map((r) => `${r.agencyId}::${r.propertyAddress.trim().toLowerCase()}`),
  );

  // Deduplicate drafts into unique incoming addresses, tracking the oldest draft
  // per address (drives the "going stale" flag) and how many raw drafts collapse
  // into it. Realised keys are counted separately for the conversion rate.
  type PotentialRow = { id: string; address: string; agencyName: string | null; oldestCreatedAt: Date; count: number };
  const potentialMap = new Map<string, PotentialRow>();
  const realisedDraftKeys = new Set<string>();
  let alreadyRealisedDrafts = 0;
  for (const r of draftRows) {
    const key = `${r.agencyId}::${r.propertyAddress.trim().toLowerCase()}`;
    if (realisedKeys.has(key)) {
      alreadyRealisedDrafts += 1;
      realisedDraftKeys.add(key);
      continue;
    }
    const existing = potentialMap.get(key);
    if (!existing) {
      potentialMap.set(key, {
        id: r.id,
        address: r.propertyAddress,
        agencyName: r.agency?.name ?? null,
        oldestCreatedAt: r.createdAt,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (r.createdAt < existing.oldestCreatedAt) existing.oldestCreatedAt = r.createdAt;
    }
  }
  const potentialRows = Array.from(potentialMap.values()).sort(
    (a, b) => a.oldestCreatedAt.getTime() - b.oldestCreatedAt.getTime(),
  );
  const potentialPipelineCount = potentialRows.length;
  const staleDraftCount = potentialRows.filter((r) => r.oldestCreatedAt < staleBefore).length;
  const totalDraftRows = draftRows.length;
  const agenciesWithDrafts = draftAgencyIds.length;

  // Conversion: of every address that has ever had a draft, how many now have a
  // real (non-draft) sale?
  const uniqueRealised = realisedDraftKeys.size;
  const conversionDen = uniqueRealised + potentialPipelineCount;
  const conversionPct = conversionDen > 0 ? Math.round((uniqueRealised / conversionDen) * 100) : 0;

  // Portal opt-out telemetry derived values.
  const portalSkipTotal = portalSkipAggregate._sum.portalInviteSkipCount ?? 0;
  const portalSkipUsers = portalSkipAggregate._count._all;

  function pct(curr: number, prev: number): number {
    if (!prev || prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  // Current window = rolled-up history (last 7 days excl today) + today live.
  const statRows = [
    { label: "New signups",          metric: "signups",      curr: (currentUser._sum.signups ?? 0)            + today.signups,             prev: previousUser._sum.signups ?? 0,           good: true },
    { label: "Transactions created", metric: "transactions", curr: (currentTx._sum.transactionsCreated ?? 0)  + today.transactionsCreated, prev: previousTx._sum.transactionsCreated ?? 0,  good: true },
    { label: "Milestones confirmed", metric: "milestones",   curr: (currentTx._sum.milestonesConfirmed ?? 0)  + today.milestonesConfirmed, prev: previousTx._sum.milestonesConfirmed ?? 0,  good: true },
    { label: "Chases sent",          metric: "chases",       curr: (currentTx._sum.chasesSent ?? 0)           + today.chasesSent,          prev: previousTx._sum.chasesSent ?? 0,           good: true },
    { label: "AI drafts generated",  metric: "ai_drafts",    curr: (currentTx._sum.aiDraftsGenerated ?? 0)    + today.aiDraftsGenerated,   prev: previousTx._sum.aiDraftsGenerated ?? 0,    good: true },
  ];

  // Today vs 7-day average (average over the 7 completed days).
  const days = dailyRows.length || 1;
  const avgMilestones = Math.round(dailyRows.reduce((a, r) => a + r.milestonesConfirmed, 0) / days);
  const avgTxns       = Math.round(dailyRows.reduce((a, r) => a + r.transactionsCreated, 0) / days);
  const avgSignups    = Math.round(dailyRows.reduce((a, r) => a + r.signups, 0) / days);

  // Pulse strip = 7 completed days + today (live), tinted distinctly.
  const stripRows = [
    ...dailyRows.map((r) => ({
      label: fmtDay(r.date),
      milestones: r.milestonesConfirmed,
      txns: r.transactionsCreated,
      isToday: false,
    })),
    { label: "Today", milestones: today.milestonesConfirmed, txns: today.transactionsCreated, isToday: true },
  ];
  const maxMilestones = Math.max(1, ...stripRows.map((r) => r.milestones));
  const maxTxns       = Math.max(1, ...stripRows.map((r) => r.txns));

  const signalByKey = Object.fromEntries(signalCounts.map((r) => [r.severity, r._count.id]));
  const modeLabel = mode === "sp" ? " · SP" : mode === "pm" ? " · PM" : "";

  const spSums = spWeek._sum;
  const pmSums = pmWeek._sum;
  const hasModeSplit = (spSums.signups ?? 0) + (pmSums.signups ?? 0) +
    (spSums.milestonesConfirmed ?? 0) + (pmSums.milestonesConfirmed ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-100">Today</h1>
        <AutoRefresh intervalMs={60000} />
      </div>

      {/* 7-day metric summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Platform{modeLabel} — last 7 days vs prior 7 days
          <InfoTip label="How the 7-day totals are counted">
            Last 7 days includes today live plus the six completed days before it,
            compared against the seven days before that. Internal test files are
            left out.
          </InfoTip>
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
                <WhatChanged windowStart={last7Start} windowEnd={now} metric={s.metric} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity pulse */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Activity pulse — 7 days + today
          <InfoTip label="What the pulse strip shows">
            Seven completed days of platform activity with today&apos;s live bar on
            the right. Today is still filling in, so its bar usually sits lower
            until the evening.
          </InfoTip>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
          <div className="space-y-4">
            {/* Heat strip — milestones */}
            <div>
              <p className="text-[11px] text-neutral-500 mb-2">Milestones confirmed / day</p>
              <div className="flex items-end gap-1 h-10">
                {stripRows.map((r, i) => {
                  const h = Math.max(4, Math.round((r.milestones / maxMilestones) * 40));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      <span className="text-[9px] text-neutral-500 tabular-nums mb-0.5">{r.milestones}</span>
                      <div
                        style={{ height: `${h}px` }}
                        className={`w-full rounded-sm transition-colors ${r.isToday ? "bg-[#FF6B4A] hover:bg-[#FF6B4A]" : "bg-[#FF6B4A]/50 hover:bg-[#FF6B4A]/80"}`}
                        title={`${r.label}: ${r.milestones}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {stripRows.map((r, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className={`text-[9px] ${r.isToday ? "text-[#FF6B4A] font-semibold" : "text-neutral-600"}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heat strip — transactions */}
            <div>
              <p className="text-[11px] text-neutral-500 mb-2">Transactions created / day</p>
              <div className="flex items-end gap-1 h-8">
                {stripRows.map((r, i) => {
                  const h = Math.max(2, Math.round((r.txns / maxTxns) * 24));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      <span className="text-[9px] text-neutral-500 tabular-nums mb-0.5">{r.txns}</span>
                      <div
                        style={{ height: `${h}px` }}
                        className={`w-full rounded-sm transition-colors ${r.isToday ? "bg-blue-500" : "bg-blue-500/30 hover:bg-blue-500/60"}`}
                        title={`${r.label}: ${r.txns}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Today vs avg + stuck transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            Today vs 7-day average
            <InfoTip label="How today compares">
              Today is live so far. The average is a full completed day across the
              last seven, so today normally reads lower until the day is done.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
            {[
              { label: "Milestones", today: today.milestonesConfirmed, avg: avgMilestones },
              { label: "Txns created", today: today.transactionsCreated, avg: avgTxns },
              { label: "Signups", today: today.signups, avg: avgSignups },
            ].map((row) => {
              const diff = row.today - row.avg;
              return (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tabular-nums">{row.today}</span>
                    <span className={`text-[11px] tabular-nums ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-neutral-600"}`}>
                      {diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "="} vs avg {row.avg}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            Stuck transactions
            <InfoTip label="What counts as stuck">
              Live files older than {STUCK_DAYS} days with no confirmed milestone in
              the last {STUCK_DAYS} days. Demo, migrated and internal files are left
              out. Open any file to see what it&apos;s waiting on.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-4">
              <span className={`text-4xl font-bold tabular-nums ${stuckCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {stuckCount}
              </span>
              <div>
                <p className="text-xs text-neutral-300 font-medium">
                  {stuckCount === 1 ? "transaction" : "transactions"} with no movement
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">active/on-hold, {STUCK_DAYS}+ days without a milestone</p>
              </div>
            </div>
            {stuckList.length > 0 && (
              <div className="border-t border-neutral-800 divide-y divide-neutral-800 max-h-72 overflow-y-auto">
                {stuckList.map((t) => {
                  const last = t.milestoneCompletions[0]?.completedAt ?? null;
                  const silentDays = daysSince(last ?? t.createdAt);
                  return (
                    <Link
                      key={t.id}
                      href={`/command/files?tx=${t.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 text-xs hover:bg-neutral-800/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-neutral-200 font-medium truncate">{t.propertyAddress}</p>
                        <p className="text-neutral-500 truncate">
                          {t.agency?.name ?? "— no agency —"}
                          {t.assignedUser?.name ? ` · ${t.assignedUser.name}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-amber-400/90">
                        {last ? `${silentDays}d silent` : `${silentDays}d, no milestones`}
                      </span>
                      <span className="shrink-0 text-neutral-600">→</span>
                    </Link>
                  );
                })}
                {stuckCount > stuckList.length && (
                  <p className="px-5 py-2.5 text-[11px] text-neutral-600">
                    Showing the {stuckList.length} longest-standing. {stuckCount - stuckList.length} more not shown.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Potential pipeline — agent drafts */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Potential pipeline — agent drafts
          <InfoTip label="What the pipeline shows">
            Unfinished sales agents have started but not completed. Deduplicated
            per agency by address, excluding addresses the same agency has already
            added as a real sale.
          </InfoTip>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold tabular-nums text-emerald-400">
                {potentialPipelineCount}
              </span>
              <div>
                <p className="text-xs text-neutral-300 font-medium">
                  unique {potentialPipelineCount === 1 ? "address" : "addresses"} with a draft sale
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  still incoming, not yet a real sale
                  {staleDraftCount > 0 && (
                    <span className="text-amber-400"> · {staleDraftCount} going stale</span>
                  )}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-5 pl-5 border-l border-neutral-800 self-stretch">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5 flex items-center gap-1">
                  Conversion
                  <InfoTip label="How conversion is worked out" align="right">
                    Of every address that has ever had a draft, the share that now
                    has a real sale ({uniqueRealised} of {conversionDen}).
                  </InfoTip>
                </p>
                <p className="text-base font-bold text-white tabular-nums">{conversionPct}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Total drafts</p>
                <p className="text-base font-bold text-white tabular-nums">{totalDraftRows.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Agencies</p>
                <p className="text-base font-bold text-white tabular-nums">{agenciesWithDrafts.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Already realised</p>
                <p className="text-base font-bold text-white tabular-nums">{alreadyRealisedDrafts.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {potentialRows.length > 0 && (
            <div className="border-t border-neutral-800 divide-y divide-neutral-800 max-h-72 overflow-y-auto">
              {potentialRows.slice(0, 12).map((r) => {
                const age = daysSince(r.oldestCreatedAt);
                const stale = r.oldestCreatedAt < staleBefore;
                return (
                  <Link
                    key={r.id}
                    href={`/command/files?tx=${r.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 text-xs hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-200 font-medium truncate">{r.address}</p>
                      <p className="text-neutral-500 truncate">{r.agencyName ?? "— no agency —"}</p>
                    </div>
                    {stale && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-400 bg-amber-950/50 border border-amber-900 rounded px-1.5 py-0.5">
                        stale
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums text-neutral-500">{age}d old</span>
                    <span className="shrink-0 text-neutral-600">→</span>
                  </Link>
                );
              })}
              {potentialRows.length > 12 && (
                <p className="px-5 py-2.5 text-[11px] text-neutral-600">
                  Showing the 12 oldest. {potentialRows.length - 12} more not shown.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Portal opt-out — agents who clicked "I won't be using the portal" */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Portal opt-out — agents skipping the invite prompt
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
          <div className="flex items-start gap-6 mb-4">
            <div className="flex items-center gap-4">
              <span className={`text-4xl font-bold tabular-nums ${portalSkipUsers > 0 ? "text-amber-400" : "text-neutral-500"}`}>
                {portalSkipUsers}
              </span>
              <div>
                <p className="text-xs text-neutral-300 font-medium">
                  unique {portalSkipUsers === 1 ? "agent has" : "agents have"} clicked &quot;I won&apos;t be using the portal&quot;
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  on the new-sale form, when prompted to invite buyer or seller
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-5 pl-5 border-l border-neutral-800 self-stretch">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Total clicks</p>
                <p className="text-base font-bold text-white tabular-nums">{portalSkipTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {recentPortalSkippers.length > 0 ? (
            <div className="border-t border-neutral-800 pt-3 mt-1">
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Most recent
              </p>
              <div className="divide-y divide-neutral-800">
                {recentPortalSkippers.map((u) => (
                  <div key={u.id} className="py-2 flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-200 font-medium truncate">
                        {u.name}{" "}
                        <span className="text-neutral-500 font-normal">· {u.email}</span>
                      </p>
                      <p className="text-neutral-500 truncate">
                        {u.agency?.name ?? "— no agency —"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-500 tabular-nums shrink-0">
                      <span>
                        {u.portalInviteSkipCount} {u.portalInviteSkipCount === 1 ? "click" : "clicks"}
                      </span>
                      <span>· {fmtDate(u.lastPortalInviteSkipAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-600 border-t border-neutral-800 pt-3">
              No agents have skipped the portal prompt yet.
            </p>
          )}
        </div>
      </section>

      {/* SP vs PM split */}
      {hasModeSplit && (
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            SP vs PM — last 7 days
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Self-Progressed (SP)", sums: spSums, color: "text-blue-400" },
              { label: "Progressor-Managed (PM)", sums: pmSums, color: "text-violet-400" },
            ].map(({ label, sums, color }) => (
              <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-2.5">
                <p className={`text-xs font-semibold ${color}`}>{label}</p>
                {[
                  { k: "Signups",    v: sums.signups ?? 0 },
                  { k: "Txns",       v: sums.transactionsCreated ?? 0 },
                  { k: "Milestones", v: sums.milestonesConfirmed ?? 0 },
                  { k: "Chases",     v: sums.chasesSent ?? 0 },
                ].map(({ k, v }) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{k}</span>
                    <span className="text-sm font-bold text-white tabular-nums">{v.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Signal health */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Signal health — open now</h2>
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

      {/* Experiments */}
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

    </div>
  );
}

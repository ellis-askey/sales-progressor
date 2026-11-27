import { commandDb } from "@/lib/command/prisma";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { parseMode, parseAgencies, businessTxWhere } from "@/lib/command/scope";
import { getBusinessesPulse, getBusinessNameMap } from "@/lib/command/businesses";
import { ManagedByTag } from "@/components/command/businesses/ManagedByTag";
import { londonDateStr } from "@/lib/services/metrics-rollup";
import { displayFor, SEVERITY_MEANING } from "@/lib/command/signal-display";
import WhatChanged from "@/components/command/shared/WhatChanged";
import InfoTip from "@/components/command/shared/InfoTip";
import AutoRefresh from "@/components/command/shared/AutoRefresh";
import { Sparkline } from "@/components/command/shared/Sparkline";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";

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

function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function BizStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums ${color ?? "text-white"}`}>{value}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
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

  // The business-type lens as a LIVE-transaction filter. The nightly DailyMetric
  // rollup can't separate TSP's own outsourced book from external progression
  // companies (no business dimension), so every figure on this page now reads
  // live from the base tables with this filter — TSP excluded (it has its own
  // page), the Agents / Sales-prog-companies lens honoured on every section.
  const bizTx = businessTxWhere(mode, agencyIds);
  const txBase = { isDemo: false as const, isMigrated: false as const, agency: { isInternal: false } };
  const txWhere = { ...txBase, ...bizTx };                  // direct PropertyTransaction reads
  const txRel = { transaction: { ...txBase, ...bizTx } };    // related-model reads (milestones, chases)

  // Signups follow the lens: new estate agencies for Agents, new progression
  // companies for Sales-prog-companies, both for Show all.
  const wantAgencySignups = mode !== "external";
  const wantBizSignups = mode !== "agents";

  // Carry the sidebar scope through deep links, but ONLY to pages that honour
  // it (agencies, outbound, revenue, activity). Linking scope into a page that
  // ignores it would promise a filter the destination doesn't apply.
  const scopeQs = (() => {
    const p = new URLSearchParams();
    if (mode !== "all") p.set("mode", mode);
    if (agencyIds.length > 0) p.set("agency", agencyIds.join(","));
    const s = p.toString();
    return s ? `&${s}` : "";
  })();

  // Shared "stuck file" filter — reused by the count and the list so they agree.
  // Excludes demo, admin-migrated and internal-agency files, requires the file
  // older than the stuck window, and follows the business-type lens (bizTx, which
  // also excludes TSP's own book).
  const stuckWhere = {
    status: { in: ["active" as const, "on_hold" as const] },
    isDemo: false,
    isMigrated: false,
    agency: { isInternal: false },
    createdAt: { lt: stuckBefore },
    exchangedAt: null,
    ...bizTx,
    milestoneCompletions: { none: { state: "complete" as const, completedAt: { gte: stuckBefore } } },
  };

  const sinceSpark = sevenCompletedStart;                 // 7 completed days + today = 8 day-buckets
  const priorWin = { gte: prior7Start, lt: last7Start };  // the 7 days before the current window

  const [
    createdDates, createdPrior,
    exchangedDates, exchangedPrior,
    milestoneDates, milestonePrior,
    chaseDates, chasePrior,
    agencySignupDates, agencySignupPrior,
    bizSignupDates, bizSignupPrior,
    signalCounts, unacknowledgedSignals,
    activeExperimentsCount, proposedExperimentsCount,
    stuckCount, stuckList,
    draftRows,
  ] = await Promise.all([
    // Transactions created.
    prisma.propertyTransaction.findMany({ where: { ...txWhere, createdAt: { gte: sinceSpark } }, select: { createdAt: true } }),
    prisma.propertyTransaction.count({ where: { ...txWhere, createdAt: priorWin } }),
    // Exchanges.
    prisma.propertyTransaction.findMany({ where: { ...txWhere, exchangedAt: { gte: sinceSpark } }, select: { exchangedAt: true } }),
    prisma.propertyTransaction.count({ where: { ...txWhere, exchangedAt: priorWin } }),
    // Milestones confirmed (reconciled-at-claim excluded, matching every other count here).
    prisma.milestoneCompletion.findMany({ where: { state: "complete", reconciledAtClaim: false, completedAt: { gte: sinceSpark }, ...txRel }, select: { completedAt: true } }),
    prisma.milestoneCompletion.count({ where: { state: "complete", reconciledAtClaim: false, completedAt: priorWin, ...txRel } }),
    // Chases sent (real dispatched chase emails).
    prisma.outboundMessage.findMany({ where: { purpose: "chase", sentAt: { gte: sinceSpark }, ...txRel }, select: { sentAt: true } }),
    prisma.outboundMessage.count({ where: { purpose: "chase", sentAt: priorWin, ...txRel } }),
    // Signups — agencies and/or progression companies per the lens.
    wantAgencySignups ? prisma.agency.findMany({ where: { isInternal: false, createdAt: { gte: sinceSpark } }, select: { createdAt: true } }) : Promise.resolve([] as { createdAt: Date }[]),
    wantAgencySignups ? prisma.agency.count({ where: { isInternal: false, createdAt: priorWin } }) : Promise.resolve(0),
    wantBizSignups ? prisma.progressionBusiness.findMany({ where: { isTsp: false, createdAt: { gte: sinceSpark } }, select: { createdAt: true } }) : Promise.resolve([] as { createdAt: Date }[]),
    wantBizSignups ? prisma.progressionBusiness.count({ where: { isTsp: false, createdAt: priorWin } }) : Promise.resolve(0),
    // Signal health = situations open right now (living signals: unresolved, not
    // snoozed, not yet acknowledged). Platform-wide: signals carry no business
    // dimension, so they can't follow the lens (TSP is already excluded at the
    // detector level).
    commandDb.signal.groupBy({
      by: ["severity"],
      where: { acknowledged: false, resolvedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] },
      _count: { id: true },
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 5,
    }),
    commandDb.experiment.count({ where: { status: "active" } }),
    commandDb.experiment.count({ where: { status: "proposed" } }),
    // Stuck files — count + list (identical filter, lens-aware).
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
        progressionBusinessId: true,
        milestoneCompletions: {
          where: { state: "complete" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),
    // Agent drafts for the potential-pipeline widget — lens-aware, deduped in JS below.
    prisma.propertyTransaction.findMany({
      where: { status: "draft", ...txWhere },
      select: { id: true, propertyAddress: true, agencyId: true, createdAt: true, agency: { select: { name: true } } },
    }),
  ]);

  // Bucket live timestamps into 8 days (7 completed + today), then derive totals.
  const SPARK_DAYS = 8;
  const bucketStart = sinceSpark.getTime();
  const toSeries = (dates: Date[]): number[] => {
    const b = new Array<number>(SPARK_DAYS).fill(0);
    for (const d of dates) {
      const i = Math.floor((new Date(d).getTime() - bucketStart) / dayMs);
      if (i >= 0 && i < SPARK_DAYS) b[i] += 1;
    }
    return b;
  };
  const addSeries = (a: number[], b: number[]): number[] => a.map((v, i) => v + b[i]);
  const series: Record<string, number[]> = {
    signups:      addSeries(toSeries(agencySignupDates.map((d) => d.createdAt)), toSeries(bizSignupDates.map((d) => d.createdAt))),
    transactions: toSeries(createdDates.map((d) => d.createdAt)),
    milestones:   toSeries(milestoneDates.map((d) => d.completedAt as Date)),
    chases:       toSeries(chaseDates.map((d) => d.sentAt as Date)),
    exchanges:    toSeries(exchangedDates.map((d) => d.exchangedAt as Date)),
  };
  const priorOf: Record<string, number> = {
    signups:      agencySignupPrior + bizSignupPrior,
    transactions: createdPrior,
    milestones:   milestonePrior,
    chases:       chasePrior,
    exchanges:    exchangedPrior,
  };
  // Current window = the last 7 days (buckets 1-7); today = bucket 7; the average
  // is over the 7 completed days (buckets 0-6).
  const currOf  = (m: string) => series[m].slice(1).reduce((a, b) => a + b, 0);
  const todayOf = (m: string) => series[m][SPARK_DAYS - 1];
  const avgOf   = (m: string) => Math.round(series[m].slice(0, 7).reduce((a, b) => a + b, 0) / 7);

  // Progression businesses are platform-wide (not agency-scoped), so the tile
  // only shows on the unscoped view. Slimmed to FLOW (sales today, actions
  // yesterday, payment alert) — the stock figures (MRR, friction, quiet) live
  // on the Businesses page, which also spares the per-business query fan-out
  // this page used to re-run on every 60s auto-refresh. "Sales today" now
  // excludes TSP like every other figure here (it previously included TSP
  // against a TSP-excluded denominator).
  // External progression companies — show under Show-all and Sales-prog-companies
  // (it IS the external book), hidden under Estate agents. Agency select hides it.
  const showBizCard = (mode === "all" || mode === "external") && agencyIds.length === 0;
  const [bizCount, businessSalesToday, bizPulse, bizPaymentIssues] = showBizCard
    ? await Promise.all([
        commandDb.progressionBusiness.count({ where: { isTsp: false } }),
        commandDb.propertyTransaction.count({
          where: {
            progressionBusiness: { isTsp: false },
            isDemo: false,
            businessPerSaleChargedAt: { gte: todayKey },
          },
        }),
        getBusinessesPulse(),
        commandDb.progressionBusiness.count({
          where: { isTsp: false, OR: [{ paymentFailedAt: { not: null } }, { newFileCreationBlockedAt: { not: null } }] },
        }),
      ])
    : [0, 0, null, 0];

  // Who's doing the work — the three populations (combined view only; an
  // agency multi-select still applies). Computed live from base tables over
  // the same window as the tiles (6 completed days + today) because the
  // rollup cannot split TSP from external businesses: both are serviceType
  // "outsourced", the discriminator is progressionBusinessId.
  const popBase = {
    isDemo: false,
    isMigrated: false,
    agency: { isInternal: false },
    ...(agencyIds.length > 0 ? { agencyId: { in: agencyIds } } : {}),
  };
  const POPULATIONS = [
    { key: "self", label: "Estate agents", desc: "agencies running their own sales", color: "text-blue-400",
      tx: { serviceType: "self_managed" as const, progressionBusinessId: null } },
    { key: "biz", label: "Progression companies", desc: "sales run by external businesses", color: "text-emerald-400",
      tx: { progressionBusinessId: { not: null } } },
  ];
  const populationStats = mode === "all"
    ? await Promise.all(
        POPULATIONS.map(async (p) => {
          const txWhere = { ...popBase, ...p.tx };
          const [transactions, milestones, chases] = await Promise.all([
            prisma.propertyTransaction.count({ where: { ...txWhere, createdAt: { gte: last7Start } } }),
            prisma.milestoneCompletion.count({
              where: { state: "complete", reconciledAtClaim: false, completedAt: { gte: last7Start }, transaction: txWhere },
            }),
            prisma.outboundMessage.count({
              where: { purpose: "chase", sentAt: { gte: last7Start }, transaction: txWhere },
            }),
          ]);
          return { ...p, transactions, milestones, chases };
        }),
      )
    : null;
  const hasPopulationWork =
    populationStats?.some((p) => p.transactions + p.milestones + p.chases > 0) ?? false;

  // businessId -> name for the "Managed by" tags on the stuck list (Files
  // already tags business-run files; the stuck list left them ambiguous).
  const bizNameMap = await getBusinessNameMap();

  // Second pass: which (agencyId, address) pairs from the draft set are already
  // represented by a non-draft transaction? Those are duplicates of already-
  // realised sales and don't count as "still incoming".
  const draftAgencyIds = Array.from(new Set(draftRows.map((r) => r.agencyId)));
  const realisedRows = draftAgencyIds.length === 0
    ? []
    : await prisma.propertyTransaction.findMany({
        where: { agencyId: { in: draftAgencyIds }, status: { not: "draft" }, isDemo: false, isMigrated: false, agency: { isInternal: false } },
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

  // Week-on-week delta. null = "no baseline" (prior week was zero but this week
  // isn't) — rendered as "new", not the old misleading grey "no change" that
  // hid genuine growth from zero.
  function pct(curr: number, prev: number): number | null {
    if (!prev || prev === 0) return curr > 0 ? null : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  // Tiles: current 7-day total vs the prior 7 days, each drilling through to its
  // matching list. All live and lens-aware (see the data block above).
  const statRows: {
    label: string; metric: string; curr: number; prev: number; good: boolean; href?: string;
  }[] = [
    { label: "New signups",          metric: "signups",      curr: currOf("signups"),      prev: priorOf.signups,      good: true, href: `/command/agencies?since=7d${scopeQs}` },
    { label: "Transactions created", metric: "transactions", curr: currOf("transactions"), prev: priorOf.transactions, good: true, href: "/command/files?created=7d" },
    { label: "Milestones confirmed", metric: "milestones",   curr: currOf("milestones"),   prev: priorOf.milestones,   good: true, href: `/command/activity${scopeQs ? `?${scopeQs.slice(1)}` : ""}` },
    { label: "Chases sent",          metric: "chases",       curr: currOf("chases"),       prev: priorOf.chases,       good: true, href: `/command/outbound?from=${last7Start.toISOString().slice(0, 10)}${scopeQs}` },
    { label: "Exchanges",            metric: "exchanges",    curr: currOf("exchanges"),    prev: priorOf.exchanges,    good: true, href: `/command/revenue${scopeQs ? `?${scopeQs.slice(1)}` : ""}` },
  ];

  // Today vs the 7-completed-day average, and one micro-trend per tile.
  const avgMilestones = avgOf("milestones");
  const avgTxns       = avgOf("transactions");
  const avgSignups    = avgOf("signups");
  const sparkSeries = series;

  const signalByKey = Object.fromEntries(signalCounts.map((r) => [r.severity, r._count.id]));
  const modeLabel = mode === "agents" ? " · Estate agents" : mode === "external" ? " · Sales prog companies" : "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-100">Today</h1>
        <AutoRefresh intervalMs={60000} />
      </div>

      {/* 7-day metric summary */}
      <section>
        <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
          Platform{modeLabel} — last 7 days vs prior 7 days
          <InfoTip label="How the 7-day totals are counted">
            Last 7 days includes today live plus the six completed days before it,
            compared against the seven days before that. Internal, demo and
            migrated files are left out.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statRows.map((s) => {
            const d = pct(s.curr, s.prev);
            // Top of the tile (label + value + delta). When the metric drills
            // through, this becomes a link; WhatChanged stays outside it so its
            // expander never collides with the link.
            const head = (
              <>
                <p className="text-xs text-neutral-400 mb-1">
                  {s.label}
                  {s.href && <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors"> ›</span>}
                </p>
                <p className="text-2xl font-bold text-white tabular-nums">{s.curr.toLocaleString()}</p>
                {d === null ? (
                  <p className={`text-xs tabular-nums mt-0.5 ${s.good ? "text-emerald-400" : "text-red-400"}`}>
                    new · nothing prev week
                  </p>
                ) : (
                  <p className={`text-xs tabular-nums mt-0.5 ${deltaColor(d, s.good)}`}>
                    {d !== 0 ? fmtDelta(d) : "no change"} vs prev week
                  </p>
                )}
                <Sparkline values={sparkSeries[s.metric] ?? []} className="mt-2.5 w-full text-blue-400/50" />
              </>
            );
            return (
              <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
                {s.href ? (
                  <Link href={s.href} className="block group -m-1 p-1 rounded-lg hover:bg-neutral-800/40 transition-colors">
                    {head}
                  </Link>
                ) : (
                  head
                )}
                <WhatChanged windowStart={last7Start} windowEnd={now} metric={s.metric} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Progression businesses — flow only; the full picture is the Businesses page */}
      {showBizCard && bizCount > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Progression businesses
            <InfoTip label="The business side's day">
              What your external progression businesses did: sales their teams added today,
              what they did yesterday, and any payment problems. MRR, friction and the
              per-business detail live on the Businesses page. Opens the Businesses list.
            </InfoTip>
          </h2>
          <Link
            href="/command/businesses"
            className="block bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 hover:bg-neutral-800/40 hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-start gap-x-8 gap-y-4 flex-wrap">
              <BizStat value={String(businessSalesToday)} label="sales today" />
              <BizStat value={String(bizPulse?.totalActions ?? 0)} label="actions yesterday" />
              <BizStat value={String(bizPaymentIssues)} label="payment issues" color={bizPaymentIssues > 0 ? "text-red-400" : undefined} />
              <span className="ml-auto self-center text-xs text-neutral-500">{bizCount} active →</span>
            </div>
          </Link>
        </section>
      )}

      {/* Today vs avg + stuck transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Today vs 7-day average
            <InfoTip label="How today compares">
              Today is live so far. The average is a full completed day across the
              last seven, so today normally reads lower until the day is done.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-3">
            {[
              { label: "Milestones", today: todayOf("milestones"), avg: avgMilestones },
              { label: "Transactions created", today: todayOf("transactions"), avg: avgTxns },
              { label: "Signups", today: todayOf("signups"), avg: avgSignups },
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
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Stuck transactions
            <InfoTip label="What counts as stuck">
              Live files older than {STUCK_DAYS} days with no confirmed milestone in
              the last {STUCK_DAYS} days. Demo, migrated and internal files are left
              out. Open any file to see what it&apos;s waiting on.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <Link href="/command/files?att=idle" className="px-5 py-4 flex items-center gap-4 group hover:bg-neutral-800/40 transition-colors">
              <span className={`text-4xl font-bold tabular-nums ${stuckCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {stuckCount}
              </span>
              <div>
                <p className="text-xs text-neutral-300 font-medium">
                  {stuckCount === 1 ? "transaction" : "transactions"} with no movement
                  <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors"> ›</span>
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">active/on-hold, {STUCK_DAYS}+ days without a milestone</p>
              </div>
            </Link>
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
                          {t.progressionBusinessId && bizNameMap.get(t.progressionBusinessId) && (
                            <span className="ml-1.5 inline-block align-middle">
                              <ManagedByTag businessName={bizNameMap.get(t.progressionBusinessId)!} />
                            </span>
                          )}
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

      {/* Potential pipeline — agent drafts. Hidden until any draft exists:
          a permanent 0-and-0% block was pre-launch noise. */}
      {totalDraftRows > 0 && (
      <section>
        <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
          Potential pipeline — agent drafts
          <InfoTip label="What the pipeline shows">
            Unfinished sales agents have started but not completed. Deduplicated
            per agency by address, excluding addresses the same agency has already
            added as a real sale.
          </InfoTip>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-6 flex-wrap">
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
            {/* flex-wrap on the parent: this cluster drops below the count on
                narrow content instead of crushing it (audit F4). The border-l
                divider only reads correctly side-by-side, so it goes at lg+. */}
            <div className="lg:ml-auto flex items-center gap-5 flex-wrap lg:pl-5 lg:border-l border-neutral-800 self-stretch">
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
      )}

      {/* Portal opt-out relocated to App adoption (CC rebuild Today PR4): it is
          lifetime adoption telemetry, not daily ops, and had no home there. */}

      {/* Who's doing the work — the three populations */}
      {populationStats && hasPopulationWork && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Who&rsquo;s doing the work — last 7 days
            <InfoTip label="How sales are attributed">
              Every sale is run either by the estate agency itself or by an
              external progression company. Same window as the tiles above: six
              completed days plus today live. Our own outsourced book is kept out
              of here and lives on the TSP Outsourced page.
            </InfoTip>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {populationStats.map((p) => (
              <div key={p.key} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-2.5">
                <div>
                  <p className={`text-xs font-semibold ${p.color}`}>{p.label}</p>
                  <p className="text-[10.5px] text-neutral-600">{p.desc}</p>
                </div>
                {[
                  { k: "Sales started", v: p.transactions },
                  { k: "Milestones", v: p.milestones },
                  { k: "Chases", v: p.chases },
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
        <h2 className="text-xs font-semibold text-neutral-400 mb-4">Signal health — open now</h2>
        <div className="flex items-center gap-3 flex-wrap mb-5">
          {(["critical", "leak", "opportunity", "info"] as const).map((sev) => (
            <Link
              key={sev}
              href={`/command/insights?sev=${sev}`}
              title={SEVERITY_MEANING[sev]}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-80 ${SEVERITY_BADGE[sev]}`}
            >
              <span className="tabular-nums font-bold">{signalByKey[sev] ?? 0}</span>
              <span className="opacity-70">{sev}</span>
            </Link>
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
                // Plain-English title + per-signal deep link from the same
                // display layer the Briefing uses (these were raw detector
                // slugs in unclickable rows before).
                const d = displayFor(s.detectorName);
                return (
                  <div key={s.id} className="flex items-stretch gap-1 hover:bg-neutral-800/40 transition-colors">
                    <Link
                      href={d.href(payload) ?? "/command/insights"}
                      className="flex-1 min-w-0 px-4 py-3 flex items-start gap-3"
                    >
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                        {s.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-200 truncate">{d.title(payload)}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {d.group} · {Math.round(s.confidence * 100)}% confidence · {fmtDate(s.detectedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-neutral-600 self-center">→</span>
                    </Link>
                    {/* Clear a signal without leaving the page (same acknowledge
                        action as the Briefing). */}
                    <div className="flex items-center pr-2.5">
                      <AcknowledgeButton signalId={s.id} compact />
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

      {/* Growth tests — one line, only when there's something to say. The full
          picture (cards, hypotheses, suggestions) is the Growth tests page;
          repeating its counts in a zero-state card said nothing. */}
      {activeExperimentsCount + proposedExperimentsCount > 0 && (
        <section>
          <Link
            href="/command/growth?tab=experiments&view=tests"
            className="flex items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-3.5 hover:bg-neutral-800/40 hover:border-neutral-700 transition-colors"
          >
            <span className="text-sm text-neutral-300">
              Growth tests:{" "}
              <span className="font-bold text-white tabular-nums">{activeExperimentsCount}</span> running ·{" "}
              <span className="font-bold text-white tabular-nums">{proposedExperimentsCount}</span> proposed
            </span>
            <span className="text-neutral-600">→</span>
          </Link>
        </section>
      )}

    </div>
  );
}

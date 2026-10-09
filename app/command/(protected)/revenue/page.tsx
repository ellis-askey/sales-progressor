import Link from "next/link";
import { getRevenueDashboard, formatGBP, formatShortDate, formatMonthLabel } from "@/lib/command/revenue";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import type { AgencyRevenueRow, ExchangeRow, LegacyAgencyRef, PipelineBucket, SimpleAgencyRef } from "@/lib/command/revenue";
import InfoTip from "@/components/command/shared/InfoTip";
import { CollapsibleSection } from "@/components/command/revenue/CollapsibleSection";
import { getBusinessesRevenue } from "@/lib/command/businesses";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const data = await getRevenueDashboard({ mode, agencyIds });

  // Whole-platform view only (no agency / mode filter): the businesses' income
  // is TSP income, not attributable to any one agency, so it shows alongside the
  // agency + provider streams only here. Scoped views stay agency-only.
  const whole = mode === "combined" && agencyIds.length === 0;
  const bizRev = whole ? await getBusinessesRevenue() : null;
  const agencyMtd = data.banked.totalPence;
  const providerMtd = data.referralIncome.wonThisMonthPence;
  const businessMtd = bizRev?.thisMonthPence ?? 0;
  const totalIncomeMtd = agencyMtd + providerMtd + businessMtd;

  const monthLabel = formatMonthLabel(data.monthStart);
  const nextMonthLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 86_400_000));
  const monthAfterLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 35 * 86_400_000));

  // Carry the current mode/agency filter through to the breakdown drill-downs.
  const scopeQs = (() => {
    const p = new URLSearchParams();
    if (sp.mode) p.set("mode", sp.mode);
    if (sp.agency) p.set("agency", sp.agency);
    const s = p.toString();
    return s ? `&${s}` : "";
  })();
  const breakdownHref = (metric: "banked" | "pipeline" | "forecast") => `/command/revenue/breakdown?metric=${metric}${scopeQs}`;

  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Revenue</h1>
        <p className="text-xs text-neutral-500">
          {monthLabel} · as of {formatShortDate(data.asOf)}
        </p>
      </div>

      {/* ── Total income this month (all three streams, due on the 1st) ── */}
      {whole && bizRev && (
        <section className="space-y-4">
          <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 to-neutral-900 px-6 py-5">
            <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              Total income this month · due on the 1st
              <InfoTip label="What this is">
                Everything earned this month and billed on the 1st of next month: agency fees on sales that exchanged
                this month, your provider referral cuts won this month, and the progression businesses&rsquo;
                subscriptions plus £5 per sale.
              </InfoTip>
            </p>
            <p className="mt-2 text-4xl sm:text-5xl font-semibold tabular-nums text-emerald-200">{formatGBP(totalIncomeMtd)}</p>
            <p className="mt-1.5 text-sm text-neutral-400">
              {formatGBP(agencyMtd)} agency fees · {formatGBP(providerMtd)} provider 10%s · {formatGBP(businessMtd)} progression businesses
            </p>
          </div>

          {bizRev.count > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi label="Recurring MRR" value={formatGBP(bizRev.mrrPence)} sub="businesses · repeats every month" tone="primary" href="/command/businesses" />
                <Kpi label="Business income this month" value={formatGBP(bizRev.thisMonthPence)} sub="subscriptions + £5 per sale" href="/command/businesses" />
                <Kpi label="Provider 10%s this month" value={formatGBP(providerMtd)} sub="referrals won this month" href="/command/providers/quotes?status=won" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Progression businesses</h2>
                  <Link href="/command/businesses" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl divide-y divide-neutral-800">
                  {bizRev.rows.slice(0, 8).map((r) => (
                    <Link
                      key={r.id}
                      href={`/command/businesses/${r.id}`}
                      className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap px-4 py-2.5 hover:bg-neutral-800/40 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm text-neutral-200">{r.name}</span>
                        <BusinessStatusPill status={r.status} />
                      </span>
                      <span className="text-xs tabular-nums text-neutral-400 whitespace-nowrap">
                        {formatGBP(r.mrrPence)}/mo · {formatGBP(r.monthTotalPence)} this month
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-600">No progression businesses yet. Their subscriptions and £5-per-sale will show here once they sign up.</p>
          )}
        </section>
      )}

      {/* ── Headline: total fee in pipeline (all active sales) ────── */}
      <section>
        <div className="bg-gradient-to-br from-blue-950/40 to-neutral-900 border border-blue-900/50 rounded-xl px-6 py-5">
          <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
            Total fee in pipeline · all active sales
            <InfoTip label="What the book is">
              Expected fees across every active file, whenever it&rsquo;s predicted to exchange. An estimate (fees only
              firm up at exchange), and it excludes on-hold files, which sit in their own paused bucket below.
            </InfoTip>
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums text-blue-300">
            {formatGBP(data.pipelineAllActive.totalPence)}
          </p>
          <p className="mt-1.5 text-sm text-neutral-400">
            Expected fees across {data.pipelineAllActive.fileCount} active file{data.pipelineAllActive.fileCount === 1 ? "" : "s"}, regardless of when they&apos;re predicted to exchange.
            {data.paused.fileCount > 0 && <> Plus <span className="text-neutral-300">{formatGBP(data.paused.totalPence)}</span> paused ({data.paused.fileCount} on hold).</>}
          </p>
          {data.priceEstimatedCount > 0 && (
            <p className="mt-1 text-[11px] text-amber-400/80">
              {data.priceEstimatedCount} file{data.priceEstimatedCount === 1 ? " has" : "s have"} no price entered yet, so the fee is estimated at the £250 band.
            </p>
          )}
        </div>
      </section>

      {/* ── Hero KPIs ─────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Banked this month"
            href={breakdownHref("banked")}
            value={formatGBP(data.banked.totalPence)}
            sub={`${data.banked.fileCount} file${data.banked.fileCount === 1 ? "" : "s"} · ${data.banked.agencyCount} agenc${data.banked.agencyCount === 1 ? "y" : "ies"}`}
            tone="primary"
            tip="What's invoiced so far this month. This month's figure reflects fee edits until the invoice is issued at month-end; once a month is issued, it stays fixed."
            trend={(() => {
              const diff = data.banked.totalPence - data.bankedLastMonthPence;
              const cls = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-neutral-600";
              return <span className={cls}>{diff >= 0 ? "+" : "−"}{formatGBP(Math.abs(diff))} vs last month ({formatGBP(data.bankedLastMonthPence)})</span>;
            })()}
          />
          <Kpi
            label="Pipeline this month"
            href={breakdownHref("pipeline")}
            value={formatGBP(data.pipelineThisMonth.totalPence)}
            sub={`${data.pipelineThisMonth.fileCount} file${data.pipelineThisMonth.fileCount === 1 ? "" : "s"} predicted to exchange in ${monthLabel}`}
            tip="Estimated fees on active files whose predicted exchange date falls in this month. An estimate, not yet billed."
          />
          <Kpi
            label="Forecast total"
            href={breakdownHref("forecast")}
            value={formatGBP(data.forecastTotalThisMonth.totalPence)}
            sub="Banked + pipeline, if everything predicted lands"
            tone="forecast"
            tip="This month's banked (actual) plus this month's pipeline (estimate). The most this month could reach if every predicted exchange lands."
          />
          <Kpi
            label="Given away this month"
            value={formatGBP(data.trialValueThisMonth.totalPence)}
            sub={`${data.trialValueThisMonth.fileCount} free exchange${data.trialValueThisMonth.fileCount === 1 ? "" : "s"} · would-be revenue`}
            tone="muted"
            tip="What free / in-house sales would have earned this month if charged at exchange, valued at £59 per exchange. Given away, not banked."
          />
        </div>
      </section>

      {/* ── Pipeline outlook ─────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          Pipeline outlook
          <InfoTip label="How the outlook works">
            Every active file, placed by its predicted exchange date. This month, next, the one after, later (beyond
            that), and at-risk (predicted date already passed but not exchanged). These five add up to the whole book.
            Paused files sit outside it.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <PipelineCell label={`${monthLabel} (pipeline)`} bucket={data.pipelineThisMonth} />
          <PipelineCell label={nextMonthLabel} bucket={data.pipelineNextMonth} />
          <PipelineCell label={monthAfterLabel} bucket={data.pipelineMonthAfter} />
          <PipelineCell label="Later" bucket={data.pipelineLater} />
          <PipelineCell label="At risk" bucket={data.pipelineAtRisk} tone="warn" />
          <PipelineCell label="Paused (on hold)" bucket={data.paused} tone="muted" />
        </div>
        <p className="mt-3 text-[11.5px] text-neutral-500 leading-relaxed">
          Ties out: {formatGBP(data.pipelineThisMonth.totalPence)} + {formatGBP(data.pipelineNextMonth.totalPence)} + {formatGBP(data.pipelineMonthAfter.totalPence)} + {formatGBP(data.pipelineLater.totalPence)} + {formatGBP(data.pipelineAtRisk.totalPence)} = <span className="text-neutral-300 font-semibold">{formatGBP(data.pipelineAllActive.totalPence)}</span> the full book.
          {" "}Next 3 months (this + next + after): <span className="text-blue-300 font-semibold">{formatGBP(data.threeMonthForecastPence)}</span>.
        </p>
      </section>

      {/* ── Where the money comes from ───────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          Where the money comes from
          <InfoTip label="How to read this">
            The active book ({formatGBP(data.pipelineAllActive.totalPence)}) split three ways, plus how this month&rsquo;s
            banked breaks down. Bars are share of the total.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BreakdownCard
            title="Pipeline by service type"
            rows={[
              { label: "Outsourced", pence: data.breakdown.pipelineByServiceType.outsourcedPence, color: "#3b82f6" },
              { label: "Self-progress (free)", pence: data.breakdown.pipelineByServiceType.inHousePence, color: "#8b9dff" },
            ]}
          />
          <BreakdownCard
            title="Pipeline by fee tier"
            rows={[
              { label: "Legacy (flat)", pence: data.breakdown.pipelineByTier.legacyPence, color: "#e0a44a" },
              { label: "Standard (sliding)", pence: data.breakdown.pipelineByTier.standardPence, color: "#34d399" },
            ]}
          />
          <BreakdownCard
            title="Pipeline by agency mode"
            rows={[
              { label: "Progressor-managed", pence: data.breakdown.pipelineByMode.pmPence, color: "#3b82f6" },
              { label: "Self-progressed", pence: data.breakdown.pipelineByMode.spPence, color: "#8b9dff" },
              { label: "Mixed", pence: data.breakdown.pipelineByMode.mixedPence, color: "#71717a" },
            ]}
          />
          <BreakdownCard
            title="Banked this month by service type"
            rows={[
              { label: "Outsourced", pence: data.breakdown.bankedByServiceType.outsourcedPence, color: "#10b981" },
              { label: "Self-progress (free)", pence: data.breakdown.bankedByServiceType.inHousePence, color: "#6ee7b7" },
            ]}
          />
        </div>
      </section>

      {/* ── Other income: provider referrals ─────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          Other income · provider referrals
          <InfoTip label="Referral income">
            Your cut on surveyor/broker quotes clients win through us. A separate stream from your sale fees. Tracked in
            the Quote inbox.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ReferralCell label="Earned (all time)" pence={data.referralIncome.earnedPence} sub={`${data.referralIncome.wonCount} won quote${data.referralIncome.wonCount === 1 ? "" : "s"}`} href="/command/providers/quotes?status=won" />
          <ReferralCell label="Collected" pence={data.referralIncome.collectedPence} sub="marked paid" href="/command/providers/quotes?status=won&collected=yes" />
          <ReferralCell label="Outstanding" pence={data.referralIncome.outstandingPence} sub="not yet collected" tone={data.referralIncome.outstandingPence > 0 ? "warn" : "default"} href="/command/providers/quotes?status=won&collected=no" />
          <Link href="/command/providers/quotes?status=won" className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-700 transition-colors flex flex-col justify-center">
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Quote inbox</p>
            <p className="mt-1 text-sm text-blue-400">Manage referrals →</p>
          </Link>
        </div>
      </section>

      {/* ── Per-agency bible ──────────────────────────────────────── */}
      <CollapsibleSection
        title="Per-agency revenue · fee tier check"
        tip={
          <InfoTip label="Reading the columns">
            Banked MTD and Lifetime are what was actually invoiced. Pipeline MTD is an estimate of what&rsquo;s predicted
            to exchange this month. Fee shows the agency&rsquo;s legacy flat fee, or the standard sliding scale.
          </InfoTip>
        }
      >
        {data.perAgency.length === 0 ? (
          <p className="text-sm text-neutral-600">No agencies in scope.</p>
        ) : (
          <PerAgencyTable rows={data.perAgency} />
        )}
      </CollapsibleSection>

      {/* ── Two-up: Recent exchanges + Outstanding/risks ──────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CollapsibleSection
            title="Recent exchanges"
            tip={
              <InfoTip label="Fee charged">
                The amount actually invoiced for each exchange (frozen once its month is issued).
              </InfoTip>
            }
          >
            {data.recentExchanges.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
                <p className="text-sm text-neutral-600">No exchanges yet in scope.</p>
              </div>
            ) : (
              <RecentExchangesTable rows={data.recentExchanges} />
            )}
          </CollapsibleSection>
        </div>
        <div>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Outstanding &amp; risks
          </h2>
          <div className="space-y-3">
            <RiskCard
              title="Building invoices"
              primary={formatGBP(data.buildingInvoices.totalPence)}
              secondary={`${data.buildingInvoices.invoiceCount} invoice${data.buildingInvoices.invoiceCount === 1 ? "" : "s"} not yet issued`}
            />
            <FlaggedAgenciesCard
              title="Failed payments"
              agencies={data.failedPayments}
              empty="No failed payments."
              tone="warn"
            />
            <FlaggedAgenciesCard
              title="Blocked from new files"
              agencies={data.blockedAgencies}
              empty="No agencies blocked."
              tone="danger"
            />
            {whole && bizRev && bizRev.needsAttention.length > 0 && (
              <div className="bg-neutral-900 border border-amber-900/40 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider mb-2">Business payments</p>
                <ul className="space-y-1.5">
                  {bizRev.needsAttention.map((b) => (
                    <li key={b.id}>
                      <Link href={`/command/businesses/${b.id}`} className="flex items-center justify-between gap-2 hover:opacity-80 transition-opacity">
                        <span className="truncate text-sm text-neutral-300">{b.name}</span>
                        <BusinessStatusPill status={b.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Fee model legend (rulebook) ──────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Fee model · the rulebook
        </h2>
        <FeeLegend legacyAgencies={data.legacyAgencies} />
      </section>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  tone = "default",
  tip,
  trend,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "primary" | "forecast" | "muted";
  tip?: ReactNode;
  trend?: ReactNode;
  href?: string;
}) {
  const valueClass =
    tone === "primary" ? "text-emerald-400" :
    tone === "forecast" ? "text-blue-400" :
    tone === "muted" ? "text-neutral-400" :
    "text-neutral-100";
  // Value + sub are the clickable drill-down; the InfoTip stays outside the link
  // (a button can't nest in an anchor), so opening the tip never navigates.
  const body = (
    <>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
      {trend && <p className="mt-1 text-[11px] tabular-nums">{trend}</p>}
    </>
  );
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
        {label}
        {href && <span className="text-neutral-600">›</span>}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </p>
      {href ? (
        <Link href={href} className="group block -mx-1 px-1 rounded-lg hover:bg-neutral-800/40 transition-colors">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

// ─── Pipeline outlook cell ────────────────────────────────────────────────────

function PipelineCell({
  label,
  bucket,
  tone = "default",
}: {
  label: string;
  bucket: PipelineBucket;
  tone?: "default" | "warn" | "muted";
}) {
  const valueClass = tone === "warn" && bucket.totalPence > 0
    ? "text-amber-400"
    : tone === "muted"
    ? "text-neutral-400"
    : "text-neutral-100";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueClass}`}>
        {formatGBP(bucket.totalPence)}
      </p>
      <p className="text-[11px] text-neutral-600">
        {bucket.fileCount} file{bucket.fileCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

// ─── Referral income cell ─────────────────────────────────────────────────────

function ReferralCell({ label, pence, sub, tone = "default", href }: { label: string; pence: number; sub: string; tone?: "default" | "warn"; href?: string }) {
  const valueClass = tone === "warn" && pence > 0 ? "text-amber-400" : "text-neutral-100";
  const inner = (
    <>
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
        {label}{href && <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors"> ›</span>}
      </p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueClass}`}>{formatGBP(pence)}</p>
      <p className="text-[11px] text-neutral-600">{sub}</p>
    </>
  );
  return href ? (
    <Link href={href} className="group bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-700 transition-colors block">{inner}</Link>
  ) : (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">{inner}</div>
  );
}

// ─── Breakdown card (where the money comes from) ──────────────────────────────

function BreakdownCard({ title, rows }: { title: string; rows: Array<{ label: string; pence: number; color: string }> }) {
  const total = rows.reduce((s, r) => s + r.pence, 0);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">{title}</p>
      {total === 0 ? (
        <p className="text-xs text-neutral-600">Nothing here yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.pence / total) * 100) : 0;
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-300">{r.label}</span>
                  <span className="tabular-nums text-neutral-200 font-medium">{formatGBP(r.pence)} <span className="text-neutral-600">· {pct}%</span></span>
                </div>
                <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Per-agency table ─────────────────────────────────────────────────────────

function PerAgencyTable({ rows }: { rows: AgencyRevenueRow[] }) {
  return (
    // overflow-x-auto + min-w: a 10-column fee ledger scrolls horizontally on
    // narrow screens rather than crushing (same pattern as AdoptionTable /
    // ProspectsBoard — audit F3; the old overflow-hidden clipped columns).
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Agency</th>
            <th className="text-center px-3 py-3 text-xs font-medium text-neutral-500">Mode</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-neutral-500">Fee tier</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Fee</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Active</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Banked MTD</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Pipeline MTD</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Lifetime</th>
            <th className="text-right px-3 py-3 text-xs font-medium text-neutral-500">Last exchange</th>
            <th className="text-center px-3 py-3 text-xs font-medium text-neutral-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => (
            <tr key={r.agencyId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-5 py-3 text-sm text-neutral-200">
                <Link href={`/command/revenue/${r.agencyId}`} className="hover:text-blue-400 transition-colors">
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-3 text-center">
                <ModeBadge mode={r.modeProfile} />
              </td>
              <td className="px-3 py-3">
                <FeeTierBadge tier={r.feeTier} />
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums">
                {r.feeTier === "legacy" && r.legacyOutsourcedFeePence != null
                  ? <span className="text-amber-300 font-semibold">{formatGBP(r.legacyOutsourcedFeePence)}</span>
                  : <span className="text-neutral-500">Free / £250–350</span>}
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-neutral-400">{r.activeFileCount || "—"}</td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-neutral-200">
                {r.bankedThisMonthPence > 0 ? formatGBP(r.bankedThisMonthPence) : <span className="text-neutral-600">—</span>}
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-neutral-400">
                {r.pipelineThisMonthPence > 0 ? formatGBP(r.pipelineThisMonthPence) : <span className="text-neutral-600">—</span>}
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-neutral-200">
                {r.lifetimeBilledPence > 0 ? formatGBP(r.lifetimeBilledPence) : <span className="text-neutral-600">—</span>}
              </td>
              <td className="px-3 py-3 text-right text-xs text-neutral-500 whitespace-nowrap">
                {formatShortDate(r.lastExchangeAt)}
              </td>
              <td className="px-3 py-3 text-center">
                <AgencyStatusBadge row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModeBadge({ mode }: { mode: AgencyRevenueRow["modeProfile"] }) {
  if (mode === "self_progressed") return <span className="text-[10px] font-semibold text-neutral-400">SP</span>;
  if (mode === "progressor_managed") return <span className="text-[10px] font-semibold text-blue-400">PM</span>;
  return <span className="text-[10px] font-semibold text-neutral-500">mixed</span>;
}

function FeeTierBadge({ tier }: { tier: AgencyRevenueRow["feeTier"] }) {
  if (tier === "legacy") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-900 font-semibold uppercase tracking-wider">
        Legacy
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 uppercase tracking-wider">
      Standard
    </span>
  );
}

function AgencyStatusBadge({ row }: { row: AgencyRevenueRow }) {
  if (row.newFileCreationBlockedAt) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-900">blocked</span>;
  }
  if (row.paymentFailedAt) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-900">payment fail</span>;
  }
  return <span className="text-[11px] text-neutral-600">·</span>;
}

// ─── Recent exchanges table ───────────────────────────────────────────────────

function RecentExchangesTable({ rows }: { rows: ExchangeRow[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Agency</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Fee band</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Fee charged</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => (
            <tr key={r.transactionId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{formatShortDate(r.exchangedAt)}</td>
              <td className="px-4 py-3 text-xs text-neutral-200">{r.propertyAddress}</td>
              <td className="px-4 py-3 text-xs text-neutral-400">
                <Link href={`/command/revenue/${r.agencyId}`} className="hover:text-blue-400 transition-colors">
                  {r.agencyName}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500">
                {r.agencyFeeTier === "legacy" && r.feeBandLabel.includes("legacy")
                  ? <span className="text-amber-300">{r.feeBandLabel}</span>
                  : r.feeBandLabel}
              </td>
              <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold text-neutral-100">
                {formatGBP(r.feeTotalPence)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Risk cards ───────────────────────────────────────────────────────────────

function RiskCard({ title, primary, secondary }: { title: string; primary: string; secondary: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{title}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-neutral-100">{primary}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{secondary}</p>
    </div>
  );
}

function FlaggedAgenciesCard({
  title,
  agencies,
  empty,
  tone,
}: {
  title: string;
  agencies: SimpleAgencyRef[];
  empty: string;
  tone: "warn" | "danger";
}) {
  const toneClass = tone === "danger" ? "text-red-400" : "text-amber-400";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{title}</p>
      {agencies.length === 0 ? (
        <p className="mt-1.5 text-xs text-neutral-600">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {agencies.map((a) => {
            const daysAgo = Math.floor((Date.now() - new Date(a.flaggedAt).getTime()) / 86_400_000);
            return (
              <li key={a.agencyId} className="flex items-center justify-between text-xs">
                <Link href={`/command/revenue/${a.agencyId}`} className="text-neutral-200 hover:text-blue-400 transition-colors truncate">
                  {a.name}
                </Link>
                <span className={`text-[11px] tabular-nums ${toneClass}`}>{daysAgo}d</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Fee legend ───────────────────────────────────────────────────────────────

function FeeLegend({ legacyAgencies }: { legacyAgencies: LegacyAgencyRef[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
        <div>
          <p className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-2">Standard pricing</p>
          <ul className="space-y-1 text-neutral-400">
            <li>Self-progress <span className="text-emerald-300">free</span> (never billed on exchange)</li>
            <li>Outsourced &le; £349,999 <span className="text-neutral-200 tabular-nums">£250</span></li>
            <li>Outsourced £350k–£499,999 <span className="text-neutral-200 tabular-nums">£300</span></li>
            <li>Outsourced &ge; £500,000 <span className="text-neutral-200 tabular-nums">£350</span></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-2">Legacy pricing (flat per sale)</p>
          {legacyAgencies.length === 0 ? (
            <p className="text-neutral-500">No legacy agencies configured.</p>
          ) : (
            <ul className="space-y-1">
              {legacyAgencies.map((a) => (
                <li key={a.agencyId} className="flex items-center justify-between text-neutral-400">
                  <span>{a.name}</span>
                  <span className="text-amber-300 tabular-nums font-semibold">{formatGBP(a.legacyOutsourcedFeePence)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-4 pt-3 border-t border-neutral-800 text-[11px] text-neutral-600 leading-relaxed">
        VAT: not registered today. When <code className="text-neutral-500">Agency.vatRegisteredAt</code> flips, invoices split into ex-VAT + 20% VAT.
        Free: self-progress never bills; each agency&apos;s first outsourced file to exchange is free (<code className="text-neutral-500">firstOutsourcedFree</code>).
        All numbers in this view exclude internal/demo agencies.
      </p>
    </div>
  );
}

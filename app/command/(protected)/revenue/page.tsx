import Link from "next/link";
import { getRevenueDashboard, formatGBP, formatShortDate, formatMonthLabel } from "@/lib/command/revenue";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import type { AgencyRevenueRow, ExchangeRow, LegacyAgencyRef, PipelineBucket, SimpleAgencyRef } from "@/lib/command/revenue";

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

  const monthLabel = formatMonthLabel(data.monthStart);
  const nextMonthLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 86_400_000));
  const monthAfterLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 35 * 86_400_000));

  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Revenue</h1>
        <p className="text-xs text-neutral-500">
          {monthLabel} · as of {formatShortDate(data.asOf)}
        </p>
      </div>

      {/* ── Headline: total fee in pipeline (all active sales) ────── */}
      <section>
        <div className="bg-gradient-to-br from-blue-950/40 to-neutral-900 border border-blue-900/50 rounded-xl px-6 py-5">
          <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
            Total fee in pipeline · all active sales
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums text-blue-300">
            {formatGBP(data.pipelineAllActive.totalPence)}
          </p>
          <p className="mt-1.5 text-sm text-neutral-400">
            Expected fees across {data.pipelineAllActive.fileCount} active file{data.pipelineAllActive.fileCount === 1 ? "" : "s"}, regardless of when they&apos;re predicted to exchange. The full book.
          </p>
        </div>
      </section>

      {/* ── Hero KPIs ─────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Banked this month"
            value={formatGBP(data.banked.totalPence)}
            sub={`${data.banked.fileCount} file${data.banked.fileCount === 1 ? "" : "s"} · ${data.banked.agencyCount} agenc${data.banked.agencyCount === 1 ? "y" : "ies"}`}
            tone="primary"
          />
          <Kpi
            label="Pipeline this month"
            value={formatGBP(data.pipelineThisMonth.totalPence)}
            sub={`${data.pipelineThisMonth.fileCount} file${data.pipelineThisMonth.fileCount === 1 ? "" : "s"} predicted to exchange in ${monthLabel}`}
          />
          <Kpi
            label="Forecast total"
            value={formatGBP(data.forecastTotalThisMonth.totalPence)}
            sub="Banked + pipeline, if everything predicted lands"
            tone="forecast"
          />
          <Kpi
            label="Trial given away"
            value={formatGBP(data.trialValueThisMonth.totalPence)}
            sub={`${data.trialValueThisMonth.fileCount} trial exchange${data.trialValueThisMonth.fileCount === 1 ? "" : "s"} this month`}
            tone="muted"
          />
        </div>
      </section>

      {/* ── Pipeline outlook ─────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Pipeline outlook
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PipelineCell label={`${monthLabel} (with banked)`} bucket={{ totalPence: data.banked.totalPence + data.pipelineThisMonth.totalPence, fileCount: data.banked.fileCount + data.pipelineThisMonth.fileCount }} />
          <PipelineCell label={nextMonthLabel} bucket={data.pipelineNextMonth} />
          <PipelineCell label={monthAfterLabel} bucket={data.pipelineMonthAfter} />
          <PipelineCell label="At risk in pipeline" bucket={data.pipelineAtRisk} tone="warn" />
        </div>
      </section>

      {/* ── Per-agency bible ──────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Per-agency revenue · fee tier check
        </h2>
        {data.perAgency.length === 0 ? (
          <p className="text-sm text-neutral-600">No agencies in scope.</p>
        ) : (
          <PerAgencyTable rows={data.perAgency} />
        )}
      </section>

      {/* ── Two-up: Recent exchanges + Outstanding/risks ──────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Recent exchanges
          </h2>
          {data.recentExchanges.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
              <p className="text-sm text-neutral-600">No exchanges yet in scope.</p>
            </div>
          ) : (
            <RecentExchangesTable rows={data.recentExchanges} />
          )}
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
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "primary" | "forecast" | "muted";
}) {
  const valueClass =
    tone === "primary" ? "text-emerald-400" :
    tone === "forecast" ? "text-blue-400" :
    tone === "muted" ? "text-neutral-400" :
    "text-neutral-100";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
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
  tone?: "default" | "warn";
}) {
  const valueClass = tone === "warn" && bucket.totalPence > 0
    ? "text-amber-400"
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

// ─── Per-agency table ─────────────────────────────────────────────────────────

function PerAgencyTable({ rows }: { rows: AgencyRevenueRow[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
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
                  : <span className="text-neutral-500">£59 / 250–350</span>}
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
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
            <li>Self-managed (in-house) <span className="text-neutral-200 tabular-nums">£59</span> inclusive per exchange</li>
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
        Trial: an agency&apos;s first file within 7 days of <code className="text-neutral-500">firstSubmissionAt</code> exchanges free.
        All numbers in this view exclude internal/demo agencies.
      </p>
    </div>
  );
}

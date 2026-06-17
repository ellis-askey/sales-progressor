import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAgencyRevenueDetail,
  formatGBP,
  formatShortDate,
  formatMonthLabel,
} from "@/lib/command/revenue";
import type { ActiveFileRow, ExchangeRow } from "@/lib/command/revenue";

export const dynamic = "force-dynamic";

export default async function AgencyRevenueDrillPage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const data = await getAgencyRevenueDetail(agencyId);
  if (!data) notFound();

  const a = data.agency;
  const monthLabel = formatMonthLabel(data.monthStart);
  const nextMonthLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 86_400_000));
  const monthAfterLabel = formatMonthLabel(new Date(data.monthEnd.getTime() + 35 * 86_400_000));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/command/revenue" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Revenue
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-2xl font-semibold text-neutral-100">{a.name}</h1>
          <p className="text-xs text-neutral-500">{monthLabel} · as of {formatShortDate(data.asOf)}</p>
        </div>
      </div>

      {/* ── Agency fact strip ────────────────────────────────────── */}
      <section>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-xs">
            <Fact label="Mode">
              {a.modeProfile === "self_progressed" ? "Self-progressed" :
               a.modeProfile === "progressor_managed" ? "Progressor-managed" :
               "Mixed"}
            </Fact>
            <Fact label="Fee tier">
              {a.feeTier === "legacy" ? (
                <span className="text-amber-300 font-semibold">
                  Legacy · {a.legacyOutsourcedFeePence != null ? formatGBP(a.legacyOutsourcedFeePence) : "not set"} per sale
                </span>
              ) : (
                <span className="text-neutral-300">Standard sliding scale</span>
              )}
            </Fact>
            <Fact label="VAT">
              {a.vatRegisteredAt
                ? <span className="text-neutral-300">Registered {formatShortDate(a.vatRegisteredAt)} · {((a.vatRateBps ?? 0) / 100).toFixed(0)}%</span>
                : <span className="text-neutral-500">Not registered</span>}
            </Fact>
            <Fact label="Stripe">
              {a.stripeCustomerId
                ? <span className="text-neutral-400 font-mono text-[10px]">{a.stripeCustomerId}</span>
                : <span className="text-neutral-600">No customer id</span>}
            </Fact>
            <Fact label="First submission">{formatShortDate(a.firstSubmissionAt)}</Fact>
            <Fact label="Account opened">{formatShortDate(a.createdAt)}</Fact>
            <Fact label="Payment status">
              {a.newFileCreationBlockedAt ? (
                <span className="text-red-400">Blocked from new files since {formatShortDate(a.newFileCreationBlockedAt)}</span>
              ) : a.paymentFailedAt ? (
                <span className="text-amber-400">Payment failed {formatShortDate(a.paymentFailedAt)}</span>
              ) : (
                <span className="text-emerald-400">Healthy</span>
              )}
            </Fact>
            <Fact label="Lifetime billed">
              <span className="text-neutral-100 font-semibold tabular-nums">{formatGBP(data.lifetimeBilledPence)}</span>
            </Fact>
          </div>
        </div>
      </section>

      {/* ── Hero KPIs (agency-scoped) ─────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Banked this month"
            value={formatGBP(data.banked.totalPence)}
            sub={`${data.banked.fileCount} file${data.banked.fileCount === 1 ? "" : "s"}`}
            tone="primary"
          />
          <Kpi
            label="Pipeline this month"
            value={formatGBP(data.pipelineThisMonth.totalPence)}
            sub={`${data.pipelineThisMonth.fileCount} predicted to exchange in ${monthLabel}`}
          />
          <Kpi
            label="Active files"
            value={String(data.activeFiles.length)}
            sub={`${data.pipelineAtRisk.fileCount} past predicted exchange`}
          />
          <Kpi
            label="Trial saved (lifetime)"
            value={formatGBP(data.trialValueLifetimePence)}
            sub={`${data.trialExchangeCountLifetime} trial exchange${data.trialExchangeCountLifetime === 1 ? "" : "s"} all time`}
            tone="muted"
          />
        </div>
      </section>

      {/* ── Pipeline outlook ─────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Pipeline outlook</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PipelineCell label={monthLabel} totalPence={data.pipelineThisMonth.totalPence} count={data.pipelineThisMonth.fileCount} />
          <PipelineCell label={nextMonthLabel} totalPence={data.pipelineNextMonth.totalPence} count={data.pipelineNextMonth.fileCount} />
          <PipelineCell label={monthAfterLabel} totalPence={data.pipelineMonthAfter.totalPence} count={data.pipelineMonthAfter.fileCount} />
          <PipelineCell label="At risk" totalPence={data.pipelineAtRisk.totalPence} count={data.pipelineAtRisk.fileCount} tone="warn" />
        </div>
      </section>

      {/* ── Active files ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Active files · expected fees
        </h2>
        {data.activeFiles.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
            <p className="text-sm text-neutral-600">No active files.</p>
          </div>
        ) : (
          <ActiveFilesTable rows={data.activeFiles} />
        )}
      </section>

      {/* ── Recent exchanges ─────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Recent exchanges
        </h2>
        {data.recentExchanges.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
            <p className="text-sm text-neutral-600">No exchanges yet.</p>
          </div>
        ) : (
          <RecentExchangesTable rows={data.recentExchanges} />
        )}
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-neutral-200">{children}</p>
    </div>
  );
}

function Kpi({
  label, value, sub, tone = "default",
}: {
  label: string; value: string; sub: string;
  tone?: "default" | "primary" | "muted";
}) {
  const valueClass =
    tone === "primary" ? "text-emerald-400" :
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

function PipelineCell({
  label, totalPence, count, tone = "default",
}: {
  label: string; totalPence: number; count: number; tone?: "default" | "warn";
}) {
  const valueClass = tone === "warn" && totalPence > 0 ? "text-amber-400" : "text-neutral-100";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueClass}`}>{formatGBP(totalPence)}</p>
      <p className="text-[11px] text-neutral-600">{count} file{count === 1 ? "" : "s"}</p>
    </div>
  );
}

function ActiveFilesTable({ rows }: { rows: ActiveFileRow[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Service</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Sale price</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Fee band</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Expected fee</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Predicted exchange</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((f) => (
            <tr key={f.transactionId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-200">{f.propertyAddress}</td>
              <td className="px-4 py-3 text-xs text-neutral-400">
                {f.serviceType === "self_managed" ? "In-house" : "Outsourced"}
              </td>
              <td className="px-4 py-3 text-right text-xs tabular-nums text-neutral-400">
                {f.purchasePricePence != null ? formatGBP(f.purchasePricePence) : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500">{f.expectedFeeLabel}</td>
              <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold text-neutral-100">
                {f.expectedFeePence != null ? formatGBP(f.expectedFeePence) : "—"}
              </td>
              <td className={`px-4 py-3 text-right text-xs whitespace-nowrap ${f.isPastPrediction ? "text-amber-400" : "text-neutral-400"}`}>
                {formatShortDate(f.predictedExchangeDate)}
                {f.isPastPrediction && <span className="ml-1 text-[10px] uppercase tracking-wider">overdue</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentExchangesTable({ rows }: { rows: ExchangeRow[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Property</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Fee band</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Fee charged</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((r) => (
            <tr key={r.transactionId} className="hover:bg-neutral-800/50 transition-colors">
              <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{formatShortDate(r.exchangedAt)}</td>
              <td className="px-4 py-3 text-xs text-neutral-200">{r.propertyAddress}</td>
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

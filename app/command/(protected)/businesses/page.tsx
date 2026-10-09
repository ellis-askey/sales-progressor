import Link from "next/link";
import { BadgeCheck, Building2, ChevronRight } from "lucide-react";
import { getBusinessesOverview, type BusinessOverviewRow } from "@/lib/command/businesses";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
import { formatGBP, formatMonthLabel } from "@/lib/command/revenue";

export const dynamic = "force-dynamic";

// Shared desktop grid template so the header and every row line up.
const COLS = "grid-cols-[minmax(150px,1.8fr)_0.7fr_0.7fr_1fr_0.7fr_0.8fr_1.1fr_auto]";

export default async function BusinessesPage() {
  const rows = await getBusinessesOverview();
  const monthLabel = formatMonthLabel(new Date());

  const totalMrr = rows.reduce((n, r) => n + r.mrrPence, 0);
  const totalMonth = rows.reduce((n, r) => n + r.monthTotalPence, 0);
  const needsAttention = rows.filter((r) => r.status === "payment_failed" || r.status === "blocked").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold text-neutral-100">Businesses</h1>
        </div>
        <p className="text-xs text-neutral-500">External sales progression businesses · figures for {monthLabel}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Businesses" value={String(rows.length)} />
        <Kpi label="Recurring MRR" value={formatGBP(totalMrr)} sub="base + seats, per month" tone="primary" />
        <Kpi label="Billed this month" value={formatGBP(totalMonth)} sub="MRR + £5 per sale" />
        <Kpi
          label="Needs attention"
          value={String(needsAttention)}
          sub="payment failed or blocked"
          tone={needsAttention > 0 ? "warn" : "muted"}
        />
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-10 text-center">
          <p className="text-sm text-neutral-400">No progression businesses yet.</p>
          <p className="mt-1 text-xs text-neutral-600">They&apos;ll appear here once the first one signs up.</p>
        </div>
      ) : (
        <section>
          {/* Desktop column header */}
          <div className={`hidden md:grid ${COLS} gap-3 px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500`}>
            <span>Business</span>
            <span className="text-right">Clients</span>
            <span className="text-right">Team</span>
            <span className="text-right">MRR</span>
            <span className="text-right">Sales</span>
            <span className="text-right">£5</span>
            <span className="text-right">This month</span>
            <span className="text-right">Status</span>
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/command/businesses/${r.id}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-900 transition-colors"
              >
                {/* Desktop row */}
                <div className={`hidden md:grid ${COLS} items-center gap-3 px-4 py-3`}>
                  <BusinessName row={r} />
                  <span className="text-right text-sm tabular-nums text-neutral-300">{r.clientCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-300">{r.memberCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-100 font-medium">{formatGBP(r.mrrPence)}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-300">{r.saleCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-300">{formatGBP(r.perSalePence)}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-100 font-medium">{formatGBP(r.monthTotalPence)}</span>
                  <span className="text-right"><BusinessStatusPill status={r.status} /></span>
                </div>

                {/* Mobile card */}
                <div className="md:hidden p-4">
                  <div className="flex items-start justify-between gap-3">
                    <BusinessName row={r} />
                    <BusinessStatusPill status={r.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Field label="MRR" value={formatGBP(r.mrrPence)} strong />
                    <Field label="This month" value={formatGBP(r.monthTotalPence)} strong />
                    <Field label="Clients" value={String(r.clientCount)} />
                    <Field label="Team" value={String(r.memberCount)} />
                    <Field label="Sales (mo)" value={String(r.saleCount)} />
                    <Field label="£5 (mo)" value={formatGBP(r.perSalePence)} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BusinessName({ row }: { row: BusinessOverviewRow }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="text-sm font-medium text-neutral-100 truncate">{row.name}</span>
      {row.senderVerified && (
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2} aria-label="Verified sender" />
      )}
      <ChevronRight className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0 ml-0.5 md:hidden" strokeWidth={2} />
    </span>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`tabular-nums ${strong ? "text-sm font-medium text-neutral-100" : "text-sm text-neutral-300"}`}>{value}</p>
    </div>
  );
}

function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "primary" | "warn" | "muted" }) {
  const valueCls =
    tone === "primary" ? "text-blue-300" : tone === "warn" ? "text-amber-300" : tone === "muted" ? "text-neutral-400" : "text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}

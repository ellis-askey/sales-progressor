import Link from "next/link";
import { BadgeCheck, Building2, ChevronRight } from "lucide-react";
import { getBusinessesOverview, getBusinessesFriction, getBusinessesPulse, type BusinessOverviewRow } from "@/lib/command/businesses";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
import { formatGBP, formatMonthLabel } from "@/lib/command/revenue";

export const dynamic = "force-dynamic";

// Shared desktop grid template so the header and every row line up.
const COLS = "grid-cols-[minmax(140px,1.7fr)_0.6fr_0.6fr_0.9fr_0.6fr_0.7fr_0.9fr_1fr_auto]";

export default async function BusinessesPage() {
  const rows = await getBusinessesOverview();
  const [frictionById, pulse] = await Promise.all([
    getBusinessesFriction(rows.map((r) => r.id)),
    getBusinessesPulse(),
  ]);
  const monthLabel = formatMonthLabel(new Date());

  const totalMrr = rows.reduce((n, r) => n + r.mrrPence, 0);
  const totalMonth = rows.reduce((n, r) => n + r.monthTotalPence, 0);
  const totalPending = rows.reduce((n, r) => n + r.pendingMigratedPence, 0);
  const totalPendingCount = rows.reduce((n, r) => n + r.pendingMigratedCount, 0);
  const needsAttention = rows.filter((r) => r.status === "payment_failed" || r.status === "blocked").length;
  const totalFriction = [...frictionById.values()].reduce((n, s) => n + s.length, 0);
  const activeYesterday = pulse.rows.filter((r) => r.actions > 0);

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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Businesses" value={String(rows.length)} />
        <Kpi label="Recurring MRR" value={formatGBP(totalMrr)} sub="base + seats, per month" tone="primary" />
        <Kpi label="Billed this month" value={formatGBP(totalMonth)} sub="MRR + £5 billed on add" />
        <Kpi
          label="On exchange"
          value={formatGBP(totalPending)}
          sub={`${totalPendingCount} migrated · bill at exchange`}
          tone={totalPending > 0 ? "primary" : "muted"}
        />
        <Kpi
          label="Friction flags"
          value={String(totalFriction)}
          sub="stuck patterns spotted"
          tone={totalFriction > 0 ? "warn" : "muted"}
        />
        <Kpi
          label="Needs attention"
          value={String(needsAttention)}
          sub="payment failed or blocked"
          tone={needsAttention > 0 ? "warn" : "muted"}
        />
      </div>

      {/* Yesterday — the daily pulse, so quiet days are visible too */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">Yesterday</h2>
        {activeYesterday.length === 0 ? (
          <p className="text-sm text-neutral-600">No business activity yesterday.</p>
        ) : (
          <ul className="space-y-1.5">
            {activeYesterday.map((p) => (
              <li key={p.id} className="text-sm text-neutral-400">
                <Link href={`/command/businesses/${p.id}`} className="text-neutral-200 hover:text-white transition-colors">{p.name}</Link>
                {" · "}{p.actions === 1 ? "1 action" : `${p.actions} actions`}
                {p.salesCreated > 0 && ` · ${p.salesCreated} ${p.salesCreated === 1 ? "sale started" : "sales started"}`}
                {p.milestonesConfirmed > 0 && ` · ${p.milestonesConfirmed} ${p.milestonesConfirmed === 1 ? "milestone" : "milestones"}`}
                {p.chasesSent > 0 && ` · ${p.chasesSent} ${p.chasesSent === 1 ? "chase" : "chases"}`}
              </li>
            ))}
          </ul>
        )}
      </section>

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
            <span className="text-right" title="Migrated sales not yet charged — the £5 bills only when they exchange">On exch.</span>
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
                  <BusinessName row={r} frictionCount={frictionById.get(r.id)?.length ?? 0} />
                  <span className="text-right text-sm tabular-nums text-neutral-300">{r.clientCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-300">{r.memberCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-100 font-medium">{formatGBP(r.mrrPence)}</span>
                  <span
                    className="text-right text-sm tabular-nums text-neutral-300"
                    title={r.migratedBilledCount > 0 ? `${r.addedSaleCount} billed on add · ${r.migratedBilledCount} on exchange` : "billed on add"}
                  >{r.saleCount}</span>
                  <span className="text-right text-sm tabular-nums text-neutral-300">{formatGBP(r.perSalePence)}</span>
                  <span className="text-right text-sm tabular-nums">
                    {r.pendingMigratedCount > 0 ? (
                      <span className="text-amber-300" title={`${r.pendingMigratedCount} migrated ${r.pendingMigratedCount === 1 ? "sale" : "sales"} waiting to exchange`}>
                        {r.pendingMigratedCount} · {formatGBP(r.pendingMigratedPence)}
                      </span>
                    ) : (
                      <span className="text-neutral-600">&mdash;</span>
                    )}
                  </span>
                  <span className="text-right text-sm tabular-nums text-neutral-100 font-medium">{formatGBP(r.monthTotalPence)}</span>
                  <span className="text-right"><BusinessStatusPill status={r.status} /></span>
                </div>

                {/* Mobile card */}
                <div className="md:hidden p-4">
                  <div className="flex items-start justify-between gap-3">
                    <BusinessName row={r} frictionCount={frictionById.get(r.id)?.length ?? 0} />
                    <BusinessStatusPill status={r.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Field label="MRR" value={formatGBP(r.mrrPence)} strong />
                    <Field label="This month" value={formatGBP(r.monthTotalPence)} strong />
                    <Field label="Clients" value={String(r.clientCount)} />
                    <Field label="Team" value={String(r.memberCount)} />
                    <Field label="Sales (mo)" value={String(r.saleCount)} />
                    <Field label="£5 (mo)" value={formatGBP(r.perSalePence)} />
                    <Field
                      label="On exchange"
                      value={r.pendingMigratedCount > 0 ? `${r.pendingMigratedCount} · ${formatGBP(r.pendingMigratedPence)}` : "—"}
                    />
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

function BusinessName({ row, frictionCount }: { row: BusinessOverviewRow; frictionCount: number }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="text-sm font-medium text-neutral-100 truncate">{row.name}</span>
      {row.senderVerified && (
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2} aria-label="Verified sender" />
      )}
      {frictionCount > 0 && (
        <span className="flex-shrink-0 text-[9.5px] font-semibold uppercase tracking-wide text-amber-300 bg-amber-950/50 border border-amber-900/60 rounded-full px-1.5 py-0.5 whitespace-nowrap">
          {frictionCount} {frictionCount === 1 ? "flag" : "flags"}
        </span>
      )}
      {row.quiet && (
        <span className="flex-shrink-0 text-[9.5px] font-semibold uppercase tracking-wide text-amber-300 bg-amber-950/50 border border-amber-900/60 rounded-full px-1.5 py-0.5 whitespace-nowrap">
          No sales this mo
        </span>
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

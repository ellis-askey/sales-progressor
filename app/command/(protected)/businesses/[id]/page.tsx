import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getBusinessDetail, type BusinessDetail } from "@/lib/command/businesses";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
import { formatGBP, formatShortDate } from "@/lib/command/revenue";

export const dynamic = "force-dynamic";

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusinessDetail(id);
  if (!b) notFound();

  const payment = paymentLine(b);
  const cancellation =
    b.schedule?.cancelAtPeriodEnd && b.schedule.endsAt
      ? `Cancels ${formatShortDate(b.schedule.endsAt)}`
      : b.subscribed
      ? "No cancellation scheduled"
      : "—";
  const senderText = b.senderEmail ?? b.senderDomain ?? "Platform default";

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link href="/command/businesses" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Businesses
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-100 break-words">{b.name}</h1>
            {b.senderVerified && <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={2} aria-label="Verified sender" />}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {b.shortName ? `“${b.shortName}” · ` : ""}joined {formatShortDate(b.createdAt)}
          </p>
        </div>
        <BusinessStatusPill status={b.status} />
      </div>

      {/* Fact strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Fact label="Subscription" value={b.subscribed ? "Active" : "None"} tone={b.subscribed ? "ok" : "muted"} />
        <Fact label="Card on file" value={b.hasCard ? "Yes" : "No"} tone={b.hasCard ? "default" : "muted"} />
        <Fact label="Payment" value={payment.text} tone={payment.tone} />
        <Fact label="Cancellation" value={cancellation} />
        <Fact label="Sends as" value={senderText} sub={b.senderVerified ? "verified" : b.senderEmail || b.senderDomain ? "not verified yet" : undefined} />
        <Fact label="Clients · Team" value={`${b.clients.filter((c) => !c.archived).length} · ${b.members.filter((m) => !m.deactivated).length}`} />
      </div>

      {/* Money this month */}
      <SectionCard title="Money this month" right={<span className="text-xs text-neutral-500">{formatShortDate(b.summary.monthStart)} onward</span>}>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-4">
          <Metric label="Recurring MRR" value={`${formatGBP(b.mrrPence)}/mo`} tone="primary" />
          <Metric label="Total this month" value={formatGBP(b.monthTotalPence)} />
          <Metric label="Sales" value={`${b.summary.saleCount} this month · ${b.lifetimeSaleCount} lifetime`} small />
        </div>
        <div className="border-t border-neutral-800 pt-3 space-y-1.5">
          <StatementLine desc="Subscription (main user)" amount={b.summary.basePence} />
          {b.summary.extraMembers > 0 && (
            <StatementLine desc={`Team members (${b.summary.extraMembers} × £39)`} amount={b.summary.seatsPence} />
          )}
          {b.summary.saleCount > 0 && (
            <StatementLine desc={`Sales this month (${b.summary.saleCount} × £5)`} amount={b.summary.perSalePence} />
          )}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-800">
            <span className="text-sm font-semibold text-neutral-200">Total</span>
            <span className="text-sm font-semibold tabular-nums text-neutral-100">{formatGBP(b.summary.totalPence)}</span>
          </div>
          <p className="pt-1 text-[11px] text-neutral-600">No VAT. TSP isn&apos;t VAT-registered on this.</p>
        </div>
      </SectionCard>

      {/* Team + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title={`Team (${b.members.length})`}>
          {b.members.length === 0 ? (
            <Empty>No members.</Empty>
          ) : (
            <ul className="space-y-2">
              {b.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className={`text-sm truncate ${m.deactivated ? "text-neutral-600 line-through" : "text-neutral-200"}`}>{m.name}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {m.isOwner && <Tag className="text-blue-300 bg-blue-950/50 border-blue-900/60">Owner</Tag>}
                    {m.deactivated && <Tag className="text-neutral-500 bg-neutral-800/60 border-neutral-700">Deactivated</Tag>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Client agencies (${b.clients.filter((c) => !c.archived).length})`}>
          {b.clients.length === 0 ? (
            <Empty>No client agencies yet.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {b.clients.map((c) => (
                <li key={c.agencyId} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className={`block text-sm truncate ${c.archived ? "text-neutral-600" : "text-neutral-200"}`}>{c.agencyName}</span>
                    <span className="block text-[11px] text-neutral-500 truncate">{c.feeSummary}</span>
                  </span>
                  {c.archived && <Tag className="text-neutral-500 bg-neutral-800/60 border-neutral-700 flex-shrink-0">Archived</Tag>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function paymentLine(b: BusinessDetail): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  const s = b.paymentState;
  if (s.kind === "warning") return { text: `Failed ${formatShortDate(s.paymentFailedAt)} · grace to ${formatShortDate(s.gracePeriodEndsAt)}`, tone: "warn" };
  if (s.kind === "blocked") return { text: `Blocked ${formatShortDate(s.blockedAt)} · new sales paused`, tone: "bad" };
  return b.subscribed ? { text: "Up to date", tone: "ok" } : { text: "Not set up yet", tone: "muted" };
}

// ── presentational helpers ──────────────────────────────────────────────────

function Fact({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-red-300" : tone === "muted" ? "text-neutral-500" : "text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-medium break-words ${cls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-600">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, tone = "default", small }: { label: string; value: string; tone?: "default" | "primary"; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 tabular-nums font-semibold ${small ? "text-sm text-neutral-300" : "text-2xl"} ${tone === "primary" ? "text-blue-300" : "text-neutral-100"}`}>{value}</p>
    </div>
  );
}

function StatementLine({ desc, amount }: { desc: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-400 truncate">{desc}</span>
      <span className="text-sm tabular-nums text-neutral-300 flex-shrink-0">{formatGBP(amount)}</span>
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${className ?? ""}`}>{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-600">{children}</p>;
}

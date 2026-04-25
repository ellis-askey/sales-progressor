import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getAgentTransactions, getAgencyTeam } from "@/lib/services/agent";
import { AnalyticsFilterClient } from "@/components/agent/AnalyticsFilterClient";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

type AgentTx = Awaited<ReturnType<typeof getAgentTransactions>>[number];

function calcFeeIncVat(t: AgentTx): number | null {
  let feeEx: number | null = null;
  if (t.agentFeeAmount != null) {
    feeEx = t.agentFeeAmount;
  } else if (t.agentFeePercent != null && t.purchasePrice != null) {
    feeEx = Math.round(t.purchasePrice * Number(t.agentFeePercent) / 100);
  }
  if (feeEx == null) return null;
  return t.agentFeeIsVatInclusive ? feeEx : Math.round(feeEx * 1.2);
}

const PERIODS = [
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
  { key: "year",  label: "Year" },
  { key: "all",   label: "All time" },
] as const;

function getPeriodStart(p: string): Date | null {
  const now = new Date();
  if (p === "week")  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (p === "month") { return new Date(now.getFullYear(), now.getMonth(), 1); }
  if (p === "year")  { return new Date(now.getFullYear(), 0, 1); }
  return null;
}

function periodHref(p: string, userId?: string) {
  const params = new URLSearchParams();
  if (p !== "month") params.set("period", p);
  if (userId) params.set("user", userId);
  const qs = params.toString();
  return `/agent/analytics${qs ? `?${qs}` : ""}`;
}

export default async function AgentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; period?: string }>;
}) {
  const session = await requireSession();
  const { user: filterUserId, period: rawPeriod } = await searchParams;
  const isDirector = session.user.role === "director";

  const period = (["week", "month", "year", "all"] as string[]).includes(rawPeriod ?? "")
    ? rawPeriod!
    : "month";

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const effectiveVis = isDirector && filterUserId
    ? { userId: filterUserId, agencyId: session.user.agencyId, seeAll: false, firmName: null }
    : vis;

  const [transactions, team] = await Promise.all([
    getAgentTransactions(effectiveVis),
    isDirector ? getAgencyTeam(session.user.agencyId, vis.firmName) : Promise.resolve([]),
  ]);

  // Period-filtered slice
  const since = getPeriodStart(period);
  const periodTx = since ? transactions.filter(t => new Date(t.createdAt) >= since) : transactions;

  // ── Period-sensitive stats ───────────────────────────────────────────────────
  const exchanged = periodTx.filter((t) => t.hasExchanged);
  const totalValue = periodTx
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);
  const exchangedValue = exchanged
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);

  const feesAll = periodTx.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const feeExchanged = exchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const totalFee = feesAll.reduce((a, b) => a + b, 0) / 100;
  const totalFeeExchanged = feeExchanged.reduce((a, b) => a + b, 0) / 100;
  const avgFee = feesAll.length > 0 ? Math.round(feesAll.reduce((a, b) => a + b, 0) / feesAll.length) / 100 : 0;
  const noFeeCount = periodTx.filter((t) => calcFeeIncVat(t) === null).length;

  // ── Referral income ──────────────────────────────────────────────────────────
  const referredTxs = periodTx.filter(t => t.referredFirmId);
  const inPipelineTxs = referredTxs.filter(t => !t.hasExchanged && !t.hasCompleted);
  const dueTxs = referredTxs.filter(t => t.hasExchanged || t.hasCompleted);
  const inPipelinePence = inPipelineTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);
  const duePence = dueTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);
  const noFeeReferralCount = referredTxs.filter(t => !t.referralFee).length;

  // ── Always-on stats (not period-filtered) ────────────────────────────────────
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const upcomingExchanges = transactions.filter(
    (t) => !t.hasExchanged && t.expectedExchangeDate &&
      new Date(t.expectedExchangeDate) >= today &&
      new Date(t.expectedExchangeDate) <= in30
  ).length;
  const avgProgress = transactions.length > 0
    ? Math.round(transactions.reduce((a, t) => a + (t.milestonePercent ?? 0), 0) / transactions.length)
    : 0;
  const noFeeTransactions = transactions.filter((t) => calcFeeIncVat(t) === null);

  // ── Bar chart — adapts to period ─────────────────────────────────────────────
  type BarEntry = { label: string; count: number };
  const barEntries: BarEntry[] = [];

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
      const count = transactions.filter(t => {
        const c = new Date(t.createdAt);
        return c >= d && c < next;
      }).length;
      barEntries.push({ label, count });
    }
  } else {
    const months = period === "month" ? 6 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      const count = transactions.filter(t => {
        const c = new Date(t.createdAt);
        return c >= d && c < end;
      }).length;
      barEntries.push({ label, count });
    }
  }

  const maxBar = Math.max(...barEntries.map(e => e.count), 1);

  const chartTitle =
    period === "week"  ? "Files submitted — last 7 days" :
    period === "month" ? "Files submitted — last 6 months" :
    period === "year"  ? "Files submitted — last 12 months" :
                         "Files submitted — all time (last 12 months)";

  const selectedName = filterUserId
    ? (team.find((m) => m.id === filterUserId)?.name ?? "Unknown")
    : "All team";

  const periodLabel = PERIODS.find(p2 => p2.key === period)?.label ?? "Month";

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Agent Portal</p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Analytics</h1>
              <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
                {isDirector ? selectedName : "An overview of your sales pipeline."}
              </p>
            </div>
            {isDirector && team.length > 0 && (
              <AnalyticsFilterClient
                team={team.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
                currentUserId={filterUserId ?? null}
              />
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-5">

        {/* ── Period filter tabs ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PERIODS.map(({ key, label }) => {
            const active = key === period;
            return (
              <Link
                key={key}
                href={periodHref(key, filterUserId)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999,
                  textDecoration: "none", transition: "all 0.15s",
                  ...(active
                    ? { background: "rgba(37,99,235,0.12)", color: "#1e40af", border: "1px solid rgba(37,99,235,0.25)" }
                    : { background: "rgba(255,255,255,0.40)", color: "var(--agent-text-muted)", border: "1px solid rgba(180,130,90,0.18)" }
                  ),
                }}
              >
                {label}
              </Link>
            );
          })}
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 4 }}>
            {period === "week" ? "last 7 days" : period === "month" ? "current month" : period === "year" ? "this year" : "all files"}
          </span>
        </div>

        {/* ── Counts row (period-filtered) ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Files submitted", value: periodTx.length },
            { label: "Exchanged", value: exchanged.length },
            { label: "Completed", value: periodTx.filter((t) => t.hasCompleted).length },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card px-5 py-4">
              <p className="glass-section-label text-slate-900/40 mb-2">{label}</p>
              <p className="text-3xl font-extrabold text-slate-900/90">{value}</p>
              <p className="text-[11px] text-slate-900/30 mt-1">{periodLabel.toLowerCase()}</p>
            </div>
          ))}
        </div>

        {/* ── Value row (period-filtered) ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-2">Pipeline value</p>
            <p className="text-2xl font-bold text-slate-900/90">{fmt(totalValue)}</p>
            <p className="text-[11px] text-slate-900/30 mt-1">purchase prices in {periodLabel.toLowerCase()}</p>
          </div>
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-2">Value exchanged</p>
            <p className="text-2xl font-bold text-emerald-600">{fmt(exchangedValue)}</p>
            <p className="text-[11px] text-slate-900/30 mt-1">exchanged files in {periodLabel.toLowerCase()}</p>
          </div>
        </div>

        {/* ── Fee analytics row (period-filtered) ──────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-1">Total fee pipeline</p>
            <p className="text-[11px] text-slate-900/30 mb-2">Inc. VAT, where set</p>
            <p className="text-2xl font-bold text-violet-600">
              {feesAll.length > 0 ? fmt(totalFee) : "—"}
            </p>
          </div>
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-1">Fees from exchanged files</p>
            <p className="text-[11px] text-slate-900/30 mb-2">Locked in</p>
            <p className="text-2xl font-bold text-emerald-600">
              {feeExchanged.length > 0 ? fmt(totalFeeExchanged) : "—"}
            </p>
          </div>
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-1">Average fee</p>
            <p className="text-[11px] text-slate-900/30 mb-2">Inc. VAT per file</p>
            <p className="text-2xl font-bold text-slate-900/80">
              {feesAll.length > 0 ? fmt(avgFee) : "—"}
            </p>
            {noFeeCount > 0 && (
              <p className="text-[11px] text-slate-900/35 mt-1">
                {noFeeCount} file{noFeeCount !== 1 ? "s" : ""} without a fee set
              </p>
            )}
          </div>
        </div>

        {/* ── Referral income (period-filtered, hidden if no referrals) ──────── */}
        {referredTxs.length > 0 && (
          <div className="space-y-2">
            <p className="glass-section-label text-slate-900/40 px-1">Referral income — {periodLabel.toLowerCase()}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card px-5 py-4">
                <p className="glass-section-label text-slate-900/40 mb-1">In pipeline</p>
                <p className="text-[11px] text-slate-900/30 mb-2">Active, pre-exchange</p>
                <p className="text-2xl font-bold text-violet-600">
                  {inPipelinePence > 0 ? fmt(inPipelinePence / 100) : "—"}
                </p>
                <p className="text-[11px] text-slate-900/35 mt-1">
                  {inPipelineTxs.length} file{inPipelineTxs.length !== 1 ? "s" : ""}
                  {noFeeReferralCount > 0 && ` · ${noFeeReferralCount} without a fee recorded`}
                </p>
              </div>
              <div className="glass-card px-5 py-4">
                <p className="glass-section-label text-slate-900/40 mb-1">Exchanged — due</p>
                <p className="text-[11px] text-slate-900/30 mb-2">Payable on/after completion</p>
                <p className="text-2xl font-bold text-amber-600">
                  {duePence > 0 ? fmt(duePence / 100) : "—"}
                </p>
                <p className="text-[11px] text-slate-900/35 mt-1">
                  {dueTxs.length} file{dueTxs.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Service split + Pipeline health (always-on) ──────────────────── */}
        <div className="glass-card px-5 py-4">
          <p className="glass-section-label text-slate-900/40 mb-4">Service split</p>
          <div className="flex gap-8">
            {[
              { label: "Self-managed (£59/mo)", value: transactions.filter((t) => t.serviceType === "self_managed").length, color: "text-blue-600" },
              { label: "Outsourced to us", value: transactions.filter((t) => t.serviceType === "outsourced").length, color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
                <p className="text-sm text-slate-900/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card px-5 py-4">
          <p className="glass-section-label text-slate-900/40 mb-4">Pipeline health</p>
          <div className="flex gap-10">
            <div>
              <p className="text-3xl font-bold text-amber-600 mb-1">{upcomingExchanges}</p>
              <p className="text-sm text-slate-900/50">Exchange{upcomingExchanges !== 1 ? "s" : ""} due in 30 days</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900/60 mb-1">{avgProgress}%</p>
              <p className="text-sm text-slate-900/50">Avg milestone progress</p>
            </div>
            {noFeeTransactions.length > 0 && (
              <div>
                <p className="text-3xl font-bold text-red-400 mb-1">{noFeeTransactions.length}</p>
                <p className="text-sm text-slate-900/50">File{noFeeTransactions.length !== 1 ? "s" : ""} missing a fee</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Bar chart ────────────────────────────────────────────────────── */}
        <div className="glass-card px-5 py-4">
          <p className="glass-section-label text-slate-900/40 mb-4">{chartTitle}</p>
          <div className="flex items-end gap-3 h-28">
            {barEntries.map(({ label, count }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-900/60">{count || ""}</span>
                <div
                  className="w-full rounded-t-sm transition-[height] duration-300"
                  style={{
                    height: `${count > 0 ? Math.max((count / maxBar) * 80, 8) : 4}px`,
                    background: count > 0 ? "rgba(37,99,235,0.75)" : "rgba(255,255,255,0.15)",
                  }}
                />
                <span className="text-[10px] text-slate-900/40 text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Files missing a fee (always-on) ─────────────────────────────── */}
        {noFeeTransactions.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/20">
              <p className="glass-section-label text-slate-900/40">Files missing a fee</p>
              <p className="text-xs text-slate-900/40 mt-1">Open each file and set the agent fee in the sidebar.</p>
            </div>
            <div className="divide-y divide-white/15">
              {noFeeTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900/80 truncate">{t.propertyAddress}</p>
                    {t.agentUser && (
                      <p className="text-xs text-slate-900/40 mt-0.5">{t.agentUser.name}</p>
                    )}
                  </div>
                  <Link
                    href={`/agent/transactions/${t.id}`}
                    className="text-xs font-medium text-blue-500 hover:text-blue-600 flex-shrink-0 transition-colors"
                  >
                    Set fee →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getAgentTransactions, getAgencyTeam } from "@/lib/services/agent";
import { getSolicitorExchangeStats, getMonthlyActivity } from "@/lib/services/analytics";
import { AnalyticsFilterClient } from "@/components/agent/AnalyticsFilterClient";
import { VolumeBarChart, MonthlyMixChart } from "@/components/analytics/AnalyticsCharts";
import { MissingFeeRow } from "@/components/analytics/MissingFeeRow";
import { LeaderboardTable, type LeaderboardRow } from "@/components/analytics/LeaderboardTable";
import type { VolumeEntry } from "@/components/analytics/AnalyticsCharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  director:        "Director",
  negotiator:      "Negotiator",
  sales_progressor: "Progressor",
};

function fmtNameShort(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function fmtOwnerLine(t: { serviceType: string | null; agentUser: { name: string; role: string } | null; assignedUser: { name: string; role: string } | null }): { line: string; awaiting: boolean } {
  if (t.serviceType === "self_managed" || t.serviceType === null) {
    if (!t.agentUser) return { line: "", awaiting: false };
    return { line: `${fmtNameShort(t.agentUser.name)} · ${ROLE_LABEL[t.agentUser.role] ?? t.agentUser.role}`, awaiting: false };
  }
  // outsourced
  if (t.assignedUser) {
    return { line: `${fmtNameShort(t.assignedUser.name)} · ${ROLE_LABEL[t.assignedUser.role] ?? t.assignedUser.role}`, awaiting: false };
  }
  return { line: "Awaiting assignment", awaiting: true };
}

function fmtGBP(pence: number) {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

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
  { key: "week",  label: "This week" },
  { key: "month", label: "This month" },
  { key: "year",  label: "This year" },
  { key: "all",   label: "All time" },
] as const;

function getPeriodStart(p: string): Date | null {
  const now = new Date();
  if (p === "week")  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "year")  return new Date(now.getFullYear(), 0, 1);
  return null;
}

function getPrevPeriodBounds(p: string): { start: Date; end: Date } | null {
  const now = new Date();
  if (p === "week") {
    const end   = new Date(now); end.setDate(end.getDate() - 7); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    return { start, end };
  }
  if (p === "month") {
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, end };
  }
  if (p === "year") {
    const end   = new Date(now.getFullYear(), 0, 1);
    const start = new Date(now.getFullYear() - 1, 0, 1);
    return { start, end };
  }
  return null;
}

function fmtDelta(curr: number, prev: number, periodWord: string): { text: string; color: string } {
  const diff = curr - prev;
  if (diff > 0) return { text: `↑ ${diff} vs last ${periodWord}`, color: "var(--agent-success)" };
  if (diff < 0) return { text: `↓ ${Math.abs(diff)} vs last ${periodWord}`, color: "var(--agent-warning)" };
  return { text: `no change vs last ${periodWord}`, color: "var(--agent-text-muted)" };
}

function periodHref(p: string, userId?: string) {
  const params = new URLSearchParams();
  if (p !== "month") params.set("period", p);
  if (userId) params.set("user", userId);
  const qs = params.toString();
  return `/agent/analytics${qs ? `?${qs}` : ""}`;
}

const DAYS_FAST = 70;
const DAYS_SLOW = 100;

function speedBadge(days: number) {
  if (days <= DAYS_FAST) return { label: "Fast", color: "var(--agent-success)", bg: "var(--agent-success-bg)", border: "var(--agent-success-border)" };
  if (days <= DAYS_SLOW) return { label: "Typical", color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" };
  return { label: "Slow", color: "var(--agent-danger)", bg: "var(--agent-danger-bg)", border: "var(--agent-danger-border)" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  const [transactions, team, solicitorStats, monthlyActivity] = await Promise.all([
    getAgentTransactions(effectiveVis),
    isDirector ? getAgencyTeam(session.user.agencyId, vis.firmName) : Promise.resolve([]),
    getSolicitorExchangeStats(effectiveVis),
    getMonthlyActivity(effectiveVis),
  ]);

  // ── Period slice ──────────────────────────────────────────────────────────
  const since    = getPeriodStart(period);
  const periodTx = since ? transactions.filter(t => new Date(t.createdAt) >= since) : transactions;

  // ── Counts ────────────────────────────────────────────────────────────────
  const exchanged  = periodTx.filter((t) => t.hasExchanged);
  const completed  = periodTx.filter((t) => t.hasCompleted);

  // ── Previous period (for deltas) ──────────────────────────────────────────
  const prevBounds   = getPrevPeriodBounds(period);
  const prevPeriodTx = prevBounds
    ? transactions.filter(t => { const c = new Date(t.createdAt); return c >= prevBounds.start && c < prevBounds.end; })
    : [];
  const prevExchanged = prevPeriodTx.filter(t => t.hasExchanged);
  const prevCompleted = prevPeriodTx.filter(t => t.hasCompleted);
  // Only show deltas when the agency had transactions before the current period started
  const hasHistory   = !!since && transactions.some(t => new Date(t.createdAt) < since);
  const showDelta    = period !== "all" && hasHistory;

  // ── Values ────────────────────────────────────────────────────────────────
  const pipelineValuePence  = periodTx.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);
  const exchangedValuePence = exchanged.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);

  // ── Fees ──────────────────────────────────────────────────────────────────
  const feesAll        = periodTx.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const feeExchanged   = exchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const totalFeePence  = feesAll.reduce((a, b) => a + b, 0);
  const lockedFeePence = feeExchanged.reduce((a, b) => a + b, 0);
  const avgFeePence    = feesAll.length > 0 ? Math.round(totalFeePence / feesAll.length) : 0;

  // ── Fee forecast ──────────────────────────────────────────────────────────
  const activePeriodTx     = periodTx.filter(t => !t.hasExchanged && !t.hasCompleted);
  const activeFees         = activePeriodTx.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const forecastPence      = activeFees.reduce((a, b) => a + b, 0);
  const totalForecastPence = forecastPence + lockedFeePence;
  const lockedPct          = totalForecastPence > 0 ? Math.round((lockedFeePence / totalForecastPence) * 100) : 0;

  // ── Referral income ───────────────────────────────────────────────────────
  const referredTxs        = periodTx.filter(t => t.referredFirmId);
  const inPipelineTxs      = referredTxs.filter(t => !t.hasExchanged && !t.hasCompleted);
  const dueTxs             = referredTxs.filter(t => t.hasExchanged || t.hasCompleted);
  const inPipelinePence    = inPipelineTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);
  const duePence           = dueTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);
  const noFeeReferralCount = referredTxs.filter(t => !t.referralFee).length;

  // ── Files missing a fee ───────────────────────────────────────────────────
  const noFeeTransactions = transactions.filter((t) => calcFeeIncVat(t) === null && t.status === "active");

  // ── Volume bar chart data ─────────────────────────────────────────────────
  const today = new Date();
  const barEntries: VolumeEntry[] = [];

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
      const count = transactions.filter(t => { const c = new Date(t.createdAt); return c >= d && c < next; }).length;
      barEntries.push({ label, count });
    }
  } else {
    const months = period === "month" ? 6 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const count = transactions.filter(t => { const c = new Date(t.createdAt); return c >= d && c < end; }).length;
      barEntries.push({ label, count });
    }
  }

  const chartTitle =
    period === "week"  ? "Files submitted — last 7 days" :
    period === "month" ? "Files submitted — last 6 months" :
    period === "year"  ? "Files submitted — last 12 months" :
                         "Files submitted — all time (last 12 months)";

  const selectedName = filterUserId
    ? (team.find((m) => m.id === filterUserId)?.name ?? "Unknown")
    : "All team";

  const periodLabel    = PERIODS.find(p2 => p2.key === period)?.label ?? "Month";
  const periodWord     = period === "week" ? "week" : period === "month" ? "month" : "year";
  const exchangeRate   = periodTx.length > 0 ? Math.round((exchanged.length / periodTx.length) * 100) : null;
  const completionRate = exchanged.length  > 0 ? Math.round((completed.length / exchanged.length) * 100) : null;
  const deltaSubmitted = showDelta ? fmtDelta(periodTx.length,   prevPeriodTx.length,  periodWord) : null;
  const deltaExchanged = showDelta ? fmtDelta(exchanged.length,  prevExchanged.length, periodWord) : null;
  const deltaCompleted = showDelta ? fmtDelta(completed.length,  prevCompleted.length, periodWord) : null;

  // ── Team leaderboard ──────────────────────────────────────────────────────
  const showLeaderboard = isDirector && !filterUserId && team.length > 1;

  const leaderboardRows: LeaderboardRow[] = (() => {
    if (!showLeaderboard) return [];
    const byUser = new Map<string, AgentTx[]>();
    for (const t of periodTx) {
      const uid = t.agentUser?.id;
      if (uid) {
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid)!.push(t);
      }
    }
    return team.map((member) => {
      const userTxs      = byUser.get(member.id) ?? [];
      const userExchanged = userTxs.filter(t => t.hasExchanged);
      const userFees      = userTxs.map(calcFeeIncVat).filter((f): f is number => f !== null);
      const userFeeEx     = userExchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
      const submitted     = userTxs.length;
      const exc           = userExchanged.length;
      return {
        id:            member.id,
        name:          member.name,
        role:          member.role,
        submitted,
        exchanged:     exc,
        conversion:    submitted > 0 ? Math.round((exc / submitted) * 100) : null,
        pipelineValue: userTxs.filter(t => !t.hasExchanged && !t.hasCompleted).reduce((s, t) => s + (t.purchasePrice ?? 0), 0),
        avgFee:        userFees.length > 0 ? Math.round(userFees.reduce((a, b) => a + b, 0) / userFees.length) : null,
        lockedFees:    userFeeEx.length  > 0 ? userFeeEx.reduce((a, b) => a + b, 0) : null,
      };
    });
  })();

  function StatCard({ label, value, sub, sub2, sub3, sub3Color, color }: { label: string; value: string | number; sub?: string; sub2?: string; sub3?: string; sub3Color?: string; color?: string }) {
    return (
      <div className="agent-glass" style={{ padding: "18px 22px" }}>
        <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: color ?? "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {value}
        </p>
        {sub  && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>}
        {sub2 && <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub2}</p>}
        {sub3 && <p style={{ margin: "3px 0 0", fontSize: 11, color: sub3Color ?? "var(--agent-text-muted)" }}>{sub3}</p>}
      </div>
    );
  }

  // ── Full empty state (zero files ever) ───────────────────────────────────
  if (transactions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="agent-glass-strong" style={{ padding: "22px 32px 26px", borderBottom: "0.5px solid var(--agent-glass-border)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(255,138,101,0.11) 0%, transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
                  Analytics
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
                  Performance and revenue across your agency.
                </p>
              </div>
              {isDirector && team.length > 0 && (
                <AnalyticsFilterClient
                  team={team.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
                  currentUserId={filterUserId ?? null}
                  basePath="/agent/analytics"
                />
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 32px" }}>
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 20 }} aria-hidden="true">
              <rect x="6"  y="30" width="10" height="12" rx="2" fill="var(--agent-coral)" opacity="0.35" />
              <rect x="19" y="20" width="10" height="22" rx="2" fill="var(--agent-coral)" opacity="0.6" />
              <rect x="32" y="10" width="10" height="32" rx="2" fill="var(--agent-coral)" />
            </svg>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>
              Analytics will appear here as you submit sales.
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.6 }}>
              Once your first file is submitted, you&apos;ll see:
            </p>
            <ul style={{ textAlign: "left", margin: "0 auto 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
              {[
                "Pipeline value and conversion rates",
                "Fee tracking and forecast",
                "Files exchanged and completed",
                "Monthly performance trends",
              ].map((item) => (
                <li key={item} style={{ fontSize: 13, color: "var(--agent-text-secondary)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: "var(--agent-coral)", flexShrink: 0, marginTop: 1 }}>·</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/agent/transactions/new"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 999, background: "var(--agent-coral)", color: "white", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
            >
              + Submit your first sale
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="agent-glass-strong px-4 pt-[18px] pb-[22px] sm:px-8 sm:pt-[22px] sm:pb-[26px]" style={{ borderBottom: "0.5px solid var(--agent-glass-border)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(255,138,101,0.11) 0%, transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
                Analytics
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
                {filterUserId
                  ? `Performance and revenue for ${selectedName}.`
                  : "Performance and revenue across your agency."}
              </p>
            </div>
            {isDirector && (
              <div className="flex items-center gap-2 flex-wrap">
                {team.length > 0 && (
                  <AnalyticsFilterClient
                    team={team.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
                    currentUserId={filterUserId ?? null}
                    basePath="/agent/analytics"
                  />
                )}
                <a
                  href={`/api/agent/analytics-export?period=${period}${filterUserId ? `&user=${filterUserId}` : ""}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 8,
                    color: "var(--agent-text-secondary)",
                    background: "rgba(255,255,255,0.50)",
                    border: "1px solid rgba(180,130,90,0.18)",
                    textDecoration: "none", whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 1v7M3 5.5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Export CSV
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-8 flex flex-col gap-[18px]">

        {/* ── Period tabs ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2, scrollbarWidth: "none" }}>
          {PERIODS.map(({ key, label }) => {
            const active = key === period;
            return (
              <Link key={key} href={periodHref(key, filterUserId)} style={{
                flexShrink: 0,
                fontSize: 12, fontWeight: 600, padding: "9px 14px", borderRadius: 999,
                textDecoration: "none", transition: "all 0.15s",
                ...(active
                  ? { background: "rgba(255,138,101,0.15)", color: "var(--agent-coral-deep)", border: "1px solid rgba(255,138,101,0.30)" }
                  : { background: "rgba(255,255,255,0.40)", color: "var(--agent-text-muted)", border: "1px solid rgba(180,130,90,0.18)" }
                ),
              }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Partial empty state banner ────────────────────────────────── */}
        {periodTx.length === 0 && period !== "all" && (
          <div style={{ background: "rgba(255,138,101,0.06)", border: "1px solid rgba(255,138,101,0.20)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
              No activity {period === "week" ? "this week" : period === "month" ? "this month" : "this year"}. Try changing the period.
            </p>
            <Link href={periodHref("all", filterUserId)} style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none", flexShrink: 0 }}>
              All time →
            </Link>
          </div>
        )}

        {/* ── Counts ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Files submitted" value={periodTx.length}  sub={periodLabel.toLowerCase()} sub3={deltaSubmitted?.text} sub3Color={deltaSubmitted?.color} color="var(--agent-coral)" />
          <StatCard label="Exchanged"       value={exchanged.length} sub={periodLabel.toLowerCase()} sub2={exchangeRate   !== null ? `${exchangeRate}% of submitted have exchanged`   : undefined} sub3={deltaExchanged?.text} sub3Color={deltaExchanged?.color} color="var(--agent-success)" />
          <StatCard label="Completed"       value={completed.length} sub={periodLabel.toLowerCase()} sub2={completionRate !== null ? `${completionRate}% of exchanged have completed` : undefined} sub3={deltaCompleted?.text} sub3Color={deltaCompleted?.color} />
        </div>

        {/* ── Values ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard label="Pipeline value"  value={fmtGBP(pipelineValuePence)}  sub={`purchase prices · ${periodLabel.toLowerCase()}`} />
          <StatCard label="Value exchanged" value={fmtGBP(exchangedValuePence)} sub={`exchanged files · ${periodLabel.toLowerCase()}`} color="var(--agent-success)" />
        </div>

        {/* ── Fees ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Total fee pipeline</p>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Inc. VAT where set</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{feesAll.length > 0 ? fmtGBP(totalFeePence) : "—"}</p>
            {noFeeTransactions.length > 0 && (
              <a href="#missing-fees" style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none" }}>
                {noFeeTransactions.length} file{noFeeTransactions.length !== 1 ? "s" : ""} need a fee →
              </a>
            )}
          </div>
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Fees locked in</p>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Exchanged files</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.02em" }}>{feeExchanged.length > 0 ? fmtGBP(lockedFeePence) : "—"}</p>
          </div>
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Average fee</p>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Inc. VAT per file</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{feesAll.length > 0 ? fmtGBP(avgFeePence) : "—"}</p>
          </div>
        </div>

        {/* ── Fee forecast ─────────────────────────────────────────────────── */}
        <div className="agent-glass" style={{ padding: "18px 22px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Fee forecast</p>
          {activeFees.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>
              <a href="#missing-fees" style={{ color: "var(--agent-coral-deep)", textDecoration: "none", fontWeight: 600 }}>Set fees on active files</a>
              {" "}to see your forecast.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: totalForecastPence > 0 ? 14 : 0 }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--agent-text-muted)" }}>If pipeline all exchanges</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>
                    {fmtGBP(totalForecastPence)}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>inc. VAT where set</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--agent-text-muted)" }}>Locked in already</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.02em" }}>
                    {lockedFeePence > 0 ? fmtGBP(lockedFeePence) : "—"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>from exchanged files</p>
                </div>
              </div>
              {totalForecastPence > 0 && (
                <div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: "var(--agent-success)", width: `${lockedPct}%` }} />
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                    {lockedPct}% secured · {100 - lockedPct}% in active pipeline
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <p className="agent-eyebrow" style={{ marginBottom: 14 }}>{chartTitle}</p>
            <VolumeBarChart data={barEntries} />
          </div>
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="agent-eyebrow">Monthly activity — last 12 months</p>
              <div style={{ display: "flex", gap: 12 }}>
                {[{ label: "Created", color: "#FF8A65" }, { label: "Exchanged", color: "#C97D1A" }].map(({ label, color }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <MonthlyMixChart data={monthlyActivity} />
          </div>
        </div>

        {/* ── Solicitor exchange performance ────────────────────────────────── */}
        {solicitorStats.length > 0 && (
          <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Solicitor exchange performance</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Average days from instruction to exchange · fastest first</p>
            </div>
            {solicitorStats.map((s, i) => {
              const badge = speedBadge(s.avgDaysToExchange);
              return (
                <div
                  key={s.firmId}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                  style={{ padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{s.firmName}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{s.exchangeCount} {s.exchangeCount === 1 ? "exchange" : "exchanges"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 64, textAlign: "right" }}>{s.avgDaysToExchange} days</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Referral income ───────────────────────────────────────────────── */}
        {referredTxs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="agent-eyebrow" style={{ paddingLeft: 2 }}>Referral income — {periodLabel.toLowerCase()}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="agent-glass" style={{ padding: "18px 22px" }}>
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>In pipeline</p>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Active, pre-exchange</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{inPipelinePence > 0 ? fmtGBP(inPipelinePence) : "—"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{inPipelineTxs.length} file{inPipelineTxs.length !== 1 ? "s" : ""}{noFeeReferralCount > 0 && ` · ${noFeeReferralCount} without a fee recorded`}</p>
              </div>
              <div className="agent-glass" style={{ padding: "18px 22px" }}>
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchanged — due</p>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Payable on/after completion</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-warning)", letterSpacing: "-0.02em" }}>{duePence > 0 ? fmtGBP(duePence) : "—"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{dueTxs.length} file{dueTxs.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Files missing a fee ───────────────────────────────────────────── */}
        <div id="missing-fees" className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: noFeeTransactions.length > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Files missing a fee</p>
            {noFeeTransactions.length > 0 && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Set the agent fee to include these files in your pipeline total.</p>
            )}
          </div>
          {noFeeTransactions.length === 0 ? (
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--agent-success)", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>✓</span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>All files have fees set.</p>
            </div>
          ) : (
            noFeeTransactions.map((t, i) => {
              const { line: ownerLine, awaiting } = fmtOwnerLine(t);
              return (
                <div key={t.id} style={{ borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
                  <MissingFeeRow
                    id={t.id}
                    propertyAddress={t.propertyAddress}
                    ownerLine={ownerLine || null}
                    awaitingAssignment={awaiting}
                    txBasePath="/agent/transactions"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ── Team leaderboard ──────────────────────────────────────────────── */}
        {showLeaderboard && (
          <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Team leaderboard</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                Performance by team member · {periodLabel.toLowerCase()}
              </p>
            </div>
            <LeaderboardTable
              rows={leaderboardRows}
              currentUserId={session.user.id}
              period={period}
            />
          </div>
        )}

      </div>
    </div>
  );
}

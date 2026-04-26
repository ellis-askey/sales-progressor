import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getAgentTransactions, getAgencyTeam } from "@/lib/services/agent";
import { getSolicitorExchangeStats, getMonthlyActivity } from "@/lib/services/analytics";
import { AnalyticsFilterClient } from "@/components/agent/AnalyticsFilterClient";
import { VolumeBarChart, MonthlyMixChart } from "@/components/analytics/AnalyticsCharts";
import type { VolumeEntry } from "@/components/analytics/AnalyticsCharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  { key: "week",  label: "Week"     },
  { key: "month", label: "Month"    },
  { key: "year",  label: "Year"     },
  { key: "all",   label: "All time" },
] as const;

function getPeriodStart(p: string): Date | null {
  const now = new Date();
  if (p === "week")  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "year")  return new Date(now.getFullYear(), 0, 1);
  return null;
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

  // ── Values ────────────────────────────────────────────────────────────────
  const pipelineValuePence  = periodTx.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);
  const exchangedValuePence = exchanged.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);

  // ── Fees ──────────────────────────────────────────────────────────────────
  const feesAll        = periodTx.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const feeExchanged   = exchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const totalFeePence  = feesAll.reduce((a, b) => a + b, 0);
  const lockedFeePence = feeExchanged.reduce((a, b) => a + b, 0);
  const avgFeePence    = feesAll.length > 0 ? Math.round(totalFeePence / feesAll.length) : 0;
  const noFeeCount     = periodTx.filter((t) => calcFeeIncVat(t) === null).length;

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

  const periodLabel = PERIODS.find(p2 => p2.key === period)?.label ?? "Month";

  function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
      <div className="agent-glass" style={{ padding: "18px 22px" }}>
        <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: color ?? "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {value}
        </p>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="agent-glass-strong" style={{ padding: "22px 32px 26px", borderBottom: "0.5px solid var(--agent-glass-border)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(255,138,101,0.11) 0%, transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 14 }}>Analytics</p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
                Analytics
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
                {isDirector ? selectedName : "Your sales pipeline"}
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

      <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Period tabs ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PERIODS.map(({ key, label }) => {
            const active = key === period;
            return (
              <Link key={key} href={periodHref(key, filterUserId)} style={{
                fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 999,
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
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 4 }}>
            {period === "week" ? "last 7 days" : period === "month" ? "current month" : period === "year" ? "this year" : "all files"}
          </span>
        </div>

        {/* ── Counts ───────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatCard label="Files submitted" value={periodTx.length}     sub={periodLabel.toLowerCase()} color="var(--agent-coral)" />
          <StatCard label="Exchanged"       value={exchanged.length}    sub={periodLabel.toLowerCase()} color="var(--agent-success)" />
          <StatCard label="Completed"       value={completed.length}    sub={periodLabel.toLowerCase()} />
        </div>

        {/* ── Values ───────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard label="Pipeline value"  value={fmtGBP(pipelineValuePence)}  sub={`purchase prices · ${periodLabel.toLowerCase()}`} />
          <StatCard label="Value exchanged" value={fmtGBP(exchangedValuePence)} sub={`exchanged files · ${periodLabel.toLowerCase()}`} color="var(--agent-success)" />
        </div>

        {/* ── Fees ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div className="agent-glass" style={{ padding: "18px 22px" }}>
            <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Total fee pipeline</p>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Inc. VAT where set</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{feesAll.length > 0 ? fmtGBP(totalFeePence) : "—"}</p>
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
            {noFeeCount > 0 && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{noFeeCount} file{noFeeCount !== 1 ? "s" : ""} without a fee set</p>}
          </div>
        </div>

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                <div key={s.firmId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.firmName}</p>
                  <span style={{ fontSize: 12, color: "var(--agent-text-muted)", flexShrink: 0 }}>{s.exchangeCount} {s.exchangeCount === 1 ? "exchange" : "exchanges"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, minWidth: 64, textAlign: "right" }}>{s.avgDaysToExchange} days</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, flexShrink: 0, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Referral income ───────────────────────────────────────────────── */}
        {referredTxs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="agent-eyebrow" style={{ paddingLeft: 2 }}>Referral income — {periodLabel.toLowerCase()}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
        {noFeeTransactions.length > 0 && (
          <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Files missing a fee</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Open each file and set the agent fee in the sidebar.</p>
            </div>
            {noFeeTransactions.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.propertyAddress}</p>
                  {t.agentUser && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{t.agentUser.name}</p>}
                </div>
                <Link href={`/agent/transactions/${t.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none", flexShrink: 0 }}>
                  Set fee →
                </Link>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

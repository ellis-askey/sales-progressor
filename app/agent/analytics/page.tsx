import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getAgentTransactions, getAgencyTeam } from "@/lib/services/agent";
import { getSolicitorExchangeStats, getMonthlyActivity, getKpiTrendsForAgency, getFilesAtRisk } from "@/lib/services/analytics";
import { AnalyticsFilterClient } from "@/components/agent/AnalyticsFilterClient";
import { AnalyticsClientShell } from "@/components/agent/AnalyticsClientShell";
import { AnalyticsNotifCta } from "@/components/analytics/AnalyticsNotifCta";

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
  if (t.assignedUser) {
    return { line: `${fmtNameShort(t.assignedUser.name)} · ${ROLE_LABEL[t.assignedUser.role] ?? t.assignedUser.role}`, awaiting: false };
  }
  return { line: "Awaiting assignment", awaiting: true };
}

function calcFeeIncVat(t: { agentFeeAmount: number | null; agentFeePercent: unknown; agentFeeIsVatInclusive: boolean | null; purchasePrice: number | null }): number | null {
  let feeEx: number | null = null;
  if (t.agentFeeAmount != null) {
    feeEx = t.agentFeeAmount;
  } else if (t.agentFeePercent != null && t.purchasePrice != null) {
    feeEx = Math.round(t.purchasePrice * Number(t.agentFeePercent) / 100);
  }
  if (feeEx == null) return null;
  return t.agentFeeIsVatInclusive ? feeEx : Math.round(feeEx * 1.2);
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

  const pageNow = new Date();
  const [transactions, team, solicitorStats, monthlyActivity, kpiSparklines, filesAtRisk] = await Promise.all([
    getAgentTransactions(effectiveVis),
    isDirector ? getAgencyTeam(session.user.agencyId, vis.firmName) : Promise.resolve([]),
    getSolicitorExchangeStats(effectiveVis),
    getMonthlyActivity(effectiveVis),
    getKpiTrendsForAgency(effectiveVis, { start: new Date(0), end: pageNow }),
    getFilesAtRisk(effectiveVis),
  ]);

  const selectedName = filterUserId
    ? (team.find((m) => m.id === filterUserId)?.name ?? "Unknown")
    : "All team";

  // noFeeFiles computed server-side (doesn't change with period)
  const noFeeTransactions = transactions.filter((t) => calcFeeIncVat(t) === null && t.status === "active");
  const noFeeFiles = noFeeTransactions.map((t) => {
    const { line, awaiting } = fmtOwnerLine(t);
    return { id: t.id, propertyAddress: t.propertyAddress, ownerLine: line || null, awaitingAssignment: awaiting };
  });

  // ── Full empty state (zero files ever) ───────────────────────────────────
  if (transactions.length === 0) {
    return (
      <>
        <div className="agent-glass-strong" style={{ padding: "22px 32px 26px", borderBottom: "0.5px solid var(--agent-glass-border)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(var(--agent-coral-base-rgb),0.11) 0%, transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
              Analytics
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-tertiary)" }}>
              Performance and revenue across your agency.
            </p>
          </div>
        </div>
        <div className="px-4 py-5 sm:px-8">
          <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px", display: "block", opacity: 0.45 }} aria-hidden="true">
              <rect x="6"  y="30" width="10" height="12" rx="2" fill="var(--agent-coral)" />
              <rect x="19" y="20" width="10" height="22" rx="2" fill="var(--agent-coral)" />
              <rect x="32" y="10" width="10" height="32" rx="2" fill="var(--agent-coral)" />
            </svg>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Analytics will appear here as you submit sales.
            </p>
            <p style={{ margin: "0 auto 20px", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
              Once your first file is submitted, you&apos;ll see pipeline value, fee tracking, conversion rates, and monthly trends.
            </p>
            <Link
              href="/agent/transactions/new"
              className="agent-btn agent-btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", fontSize: 13 }}
            >
              + Submit your first sale
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="agent-glass-strong px-4 pt-[18px] pb-[22px] sm:px-8 sm:pt-[22px] sm:pb-[26px]" style={{ borderBottom: "0.5px solid var(--agent-glass-border)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(var(--agent-coral-base-rgb),0.11) 0%, transparent 70%)" }} />
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
            <div className="flex items-center gap-2 flex-wrap">
              {isDirector && team.length > 0 && (
                <AnalyticsFilterClient
                  team={team.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
                  currentUserId={filterUserId ?? null}
                  basePath="/agent/analytics"
                />
              )}
              {isDirector && (
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
              )}
              <div className="hidden md:block">
                <AnalyticsNotifCta />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Client shell — manages period state, all stats ────────────────── */}
      <AnalyticsClientShell
        transactions={transactions.map(t => ({ ...t, agentFeePercent: t.agentFeePercent != null ? Number(t.agentFeePercent) : null }))}
        team={team.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        solicitorStats={solicitorStats}
        monthlyActivity={monthlyActivity}
        kpiSparklines={kpiSparklines}
        filesAtRisk={filesAtRisk}
        noFeeFiles={noFeeFiles}
        isDirector={isDirector}
        currentUserId={session.user.id}
        filterUserId={filterUserId ?? null}
        selectedName={selectedName}
        initialPeriod={period}
      />

    </div>
  );
}

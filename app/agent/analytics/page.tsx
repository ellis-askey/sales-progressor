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

export default async function AgentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const session = await requireSession();
  const { user: filterUserId } = await searchParams;
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const isDirector = session.user.role === "director";

  // Directors can filter by a specific negotiator; otherwise use own visibility
  const effectiveVis = isDirector && filterUserId
    ? { userId: filterUserId, agencyId: session.user.agencyId, seeAll: false, firmName: null }
    : vis;

  const [transactions, team] = await Promise.all([
    getAgentTransactions(effectiveVis),
    isDirector ? getAgencyTeam(session.user.agencyId, vis.firmName) : Promise.resolve([]),
  ]);

  const now = new Date();
  const months: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    months[key] = 0;
  }
  for (const tx of transactions) {
    const key = new Date(tx.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    if (key in months) months[key]++;
  }

  const exchanged = transactions.filter((t) => t.hasExchanged);
  const totalValue = transactions
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);
  const exchangedValue = exchanged
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);

  const feesAll = transactions.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const feeExchanged = exchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const totalFee = feesAll.reduce((a, b) => a + b, 0) / 100;
  const totalFeeExchanged = feeExchanged.reduce((a, b) => a + b, 0) / 100;
  const avgFee = feesAll.length > 0 ? Math.round(feesAll.reduce((a, b) => a + b, 0) / feesAll.length) / 100 : 0;
  const noFeeTransactions = transactions.filter((t) => calcFeeIncVat(t) === null);
  const noFeeCount = noFeeTransactions.length;

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

  const maxBar = Math.max(...Object.values(months), 1);

  const selectedName = filterUserId
    ? (team.find((m) => m.id === filterUserId)?.name ?? "Unknown")
    : "All team";

  return (
    <>
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

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total files submitted", value: transactions.length },
            { label: "Exchanged", value: exchanged.length },
            { label: "Completed", value: transactions.filter((t) => t.hasCompleted).length },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card px-5 py-4">
              <p className="glass-section-label text-slate-900/40 mb-2">{label}</p>
              <p className="text-3xl font-extrabold text-slate-900/90">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-2">Total pipeline value</p>
            <p className="text-2xl font-bold text-slate-900/90">{fmt(totalValue)}</p>
          </div>
          <div className="glass-card px-5 py-4">
            <p className="glass-section-label text-slate-900/40 mb-2">Value exchanged</p>
            <p className="text-2xl font-bold text-emerald-600">{fmt(exchangedValue)}</p>
          </div>
        </div>

        {/* Fee analytics row */}
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

        {/* Pipeline health */}
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
            {noFeeCount > 0 && (
              <div>
                <p className="text-3xl font-bold text-red-400 mb-1">{noFeeCount}</p>
                <p className="text-sm text-slate-900/50">File{noFeeCount !== 1 ? "s" : ""} missing a fee</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card px-5 py-4">
          <p className="glass-section-label text-slate-900/40 mb-4">Files submitted (last 6 months)</p>
          <div className="flex items-end gap-3 h-28">
            {Object.entries(months).map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-900/60">{count || ""}</span>
                <div
                  className="w-full rounded-t-sm transition-[height] duration-300"
                  style={{
                    height: `${count > 0 ? Math.max((count / maxBar) * 80, 8) : 4}px`,
                    background: count > 0 ? "rgba(37,99,235,0.75)" : "rgba(255,255,255,0.15)",
                  }}
                />
                <span className="text-[10px] text-slate-900/40 text-center">{month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Files missing a fee */}
        {noFeeCount > 0 && (
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

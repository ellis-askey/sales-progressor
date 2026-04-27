import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { listTransactions, countTransactionsByStatus, getExchangeForecast } from "@/lib/services/transactions";
import { listAgentRequests } from "@/lib/services/manual-tasks";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { ForecastStrip } from "@/components/transactions/ForecastStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import { AgentRequestsPanel } from "@/components/agent/AgentRequestsPanel";
import { Plus, HouseLine } from "@phosphor-icons/react/dist/ssr";
import type { TransactionStatus } from "@prisma/client";

export default async function AgentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const activeFilter = (filter as TransactionStatus | "all") ?? "active";

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const opts = vis.seeAll ? { allAgentFiles: true, firmName: vis.firmName } : undefined;
  const agentId = vis.seeAll ? undefined : session.user.id;

  const [transactions, counts, forecastMonths, agentRequests] = await Promise.all([
    listTransactions(session.user.agencyId, agentId, opts),
    countTransactionsByStatus(session.user.agencyId, agentId, opts),
    getExchangeForecast(session.user.agencyId, agentId, opts).catch(() => []),
    listAgentRequests(session.user.id, session.user.agencyId).catch(() => []),
  ]);

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.status === activeFilter);

  const isDirector = session.user.role === "director";

  return (
    <>
      {/* Warm glass header */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle coral bloom — top right, very low opacity */}
        <div aria-hidden="true" style={{
          position: "absolute", top: -60, right: -40,
          width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Subtle warm bloom — bottom left */}
        <div aria-hidden="true" style={{
          position: "absolute", bottom: -40, left: 60,
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
                My Files
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Link
                href="/agent/transactions/new"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none" }}
              >
                <Plus size={16} weight="bold" />
                New sale
              </Link>
              <AgentFlagButton transactionId={null} address="general" label="Send note to progressor" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-7">

        {forecastMonths.length > 0 && (
          <ForecastStrip months={forecastMonths} basePath="/agent/transactions" />
        )}

        <div>
          <div className="flex items-center gap-1 mb-5 glass-subtle p-1 w-full md:w-fit overflow-x-auto">
            {([
              { value: "all",       label: "All",       count: transactions.length },
              { value: "active",    label: "Active",    count: counts.active },
              { value: "on_hold",   label: "On Hold",   count: counts.on_hold },
              { value: "completed", label: "Completed", count: counts.completed },
              { value: "withdrawn", label: "Withdrawn", count: counts.withdrawn },
            ] as { value: string; label: string; count: number }[]).map(({ value, label, count }) => {
              const isActive = activeFilter === value;
              return (
                <Link
                  key={value}
                  href={value === "active" ? "/agent/dashboard" : `/agent/dashboard?filter=${value}`}
                  scroll={false}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/60 text-slate-900/90 shadow-sm"
                      : "text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20"
                  }`}
                >
                  {label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                    isActive ? "bg-blue-50/80 text-blue-600" : "bg-white/30 text-slate-900/50"
                  }`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card">
              {activeFilter === "all" ? (
                <EmptyState
                  title="Your pipeline starts here"
                  description="Add your first sale and we'll track it through to completion."
                  icon={<HouseLine size={20} className="text-blue-400" />}
                  action={
                    <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
                      <Plus size={14} weight="bold" />
                      Add a sale
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  title={`No ${activeFilter.replace("_", " ")} files`}
                  description="Try a different filter."
                  action={<Link href="/agent/dashboard?filter=all" className="text-sm text-blue-500 hover:text-blue-600">View all</Link>}
                />
              )}
            </div>
          ) : (
            <TransactionListWithSearch transactions={filtered} basePath="/agent/transactions" isDirector={isDirector} />
          )}
        </div>

        {agentRequests.length > 0 && (
          <AgentRequestsPanel requests={agentRequests} />
        )}
      </div>
    </>
  );
}


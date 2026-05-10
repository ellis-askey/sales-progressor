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
import { PageHeader } from "@/components/layout/PageHeader";

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
      <PageHeader
        title={isDirector ? "All Files" : "My Files"}
        subtitle="All property files assigned to you."
      >
        <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
          <Plus size={14} weight="bold" />
          New sale
        </Link>
        <AgentFlagButton transactionId={null} address="general" label="Send note to progressor" />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-7">

        {forecastMonths.length > 0 && (
          <ForecastStrip months={forecastMonths} basePath="/agent/transactions" />
        )}

        {transactions.length === 0 ? (
          <>
            <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <HouseLine weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                Create your first sale
              </p>
              <p style={{ margin: "0 auto 24px", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                Once you submit a sale, you&apos;ll see it here. Track milestones, manage chases, and progress to exchange.
              </p>
              <Link
                href="/agent/transactions/new"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none" }}
              >
                <Plus size={16} weight="bold" />
                New sale
              </Link>
            </div>

            {/* Ghost filter tabs + transaction rows preview */}
            <div style={{ opacity: 0.3, pointerEvents: "none" }}>
              <div className="flex items-center gap-1 mb-5 glass-subtle p-1 w-full md:w-fit overflow-x-auto">
                {["All", "Active", "On Hold", "Completed", "Withdrawn"].map((label, i) => (
                  <div key={label} className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium" style={{ background: i === 0 ? "rgba(255,255,255,0.6)" : "transparent", color: i === 0 ? "rgba(15,23,42,0.9)" : "rgba(15,23,42,0.4)" }}>
                    {label}
                    <span className="text-xs rounded-full px-1.5 py-0.5 font-normal" style={{ background: i === 0 ? "rgba(219,234,254,0.8)" : "rgba(255,255,255,0.3)", color: i === 0 ? "#2563eb" : "rgba(15,23,42,0.4)" }}>—</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { addr: "14 Maple Close, Birmingham", status: "Active" },
                  { addr: "8 The Crescent, Bristol", status: "Active" },
                  { addr: "22 Victoria Road, Manchester", status: "On Hold" },
                ].map(({ addr, status }) => (
                  <div key={addr} className="glass-card" style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addr}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>Smith & Jones · Vendor</p>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "3px 10px", background: "rgba(0,0,0,0.06)", color: "var(--agent-text-secondary)" }}>{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
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
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
                <EmptyState
                  title={`No ${activeFilter.replace("_", " ")} files`}
                  description="Try a different filter."
                  action={<Link href="/agent/dashboard" className="text-sm agent-link-primary">View all</Link>}
                />
              </div>
            ) : (
              <TransactionListWithSearch transactions={filtered} basePath="/agent/transactions" isDirector={isDirector} />
            )}
          </div>
        )}

        {agentRequests.length > 0 && (
          <AgentRequestsPanel requests={agentRequests} />
        )}
      </div>
    </>
  );
}


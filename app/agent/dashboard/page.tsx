import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { listTransactions, countTransactionsByStatus, getExchangeForecast, getExchangedNotCompleting } from "@/lib/services/transactions";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { ForecastStrip } from "@/components/transactions/ForecastStrip";
import { PostExchangeStrip } from "@/components/transactions/PostExchangeStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { TransactionStatus } from "@prisma/client";

export default async function AgentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const activeFilter = (filter as TransactionStatus | "all") ?? "all";

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const opts = vis.seeAll ? { allAgentFiles: true } : undefined;
  const agentId = vis.seeAll ? undefined : session.user.id;

  const [transactions, counts, forecastMonths, postExchangeGroups] = await Promise.all([
    listTransactions(session.user.agencyId, agentId, opts),
    countTransactionsByStatus(session.user.agencyId, agentId, opts),
    getExchangeForecast(session.user.agencyId, agentId, opts).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId, agentId, opts).catch(() => []),
  ]);

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.status === activeFilter);

  const isDirector = session.user.role === "director";

  return (
    <>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">
            {session.user.firmName ?? "Agent Portal"}
          </p>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
                {isDirector ? "All Files" : "My Files"}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{session.user.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/agent/transactions/new"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={16} weight="bold" />
                New Transaction
              </Link>
              <AgentFlagButton transactionId={null} address="general" label="Flag to progressor" />
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <StatChip value={transactions.length} label="Total files" color="text-white" />
            <div className="w-px h-6 bg-white/10" />
            <StatChip value={counts.active} label="Active" color="text-emerald-400" />
            <StatChip value={counts.on_hold} label="On hold" color="text-amber-400" />
            <StatChip value={counts.completed} label="Completed" color="text-blue-400" />
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-7">

        {postExchangeGroups.length > 0 && (
          <PostExchangeStrip groups={postExchangeGroups} basePath="/agent/transactions" />
        )}

        {forecastMonths.length > 0 && (
          <ForecastStrip months={forecastMonths} basePath="/agent/transactions" />
        )}

        <div>
          <div className="flex items-center gap-1 mb-5 glass-subtle p-1 w-fit">
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
                  href={value === "all" ? "/agent/dashboard" : `/agent/dashboard?filter=${value}`}
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
              <EmptyState
                title={activeFilter === "all" ? "No files yet" : `No ${activeFilter.replace("_", " ")} files`}
                description={activeFilter === "all" ? "Your sales will appear here once they're added." : "Try a different filter."}
                action={
                  activeFilter !== "all" ? (
                    <Link href="/agent/dashboard" className="text-sm text-blue-500 hover:text-blue-600">View all</Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <TransactionListWithSearch transactions={filtered} basePath="/agent/transactions" />
          )}
        </div>
      </div>
    </>
  );
}

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-label-tertiary-on-dark">{label}</span>
    </div>
  );
}

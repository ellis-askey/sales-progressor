import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listTransactions, countTransactionsByStatus, getExchangeForecast, getExchangedNotCompleting } from "@/lib/services/transactions";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { ForecastStrip } from "@/components/transactions/ForecastStrip";
import { PostExchangeStrip } from "@/components/transactions/PostExchangeStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import type { TransactionStatus } from "@prisma/client";

export default async function AgentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const activeFilter = (filter as TransactionStatus | "all") ?? "all";

  const agentId = session.user.id;
  const [transactions, counts, forecastMonths, postExchangeGroups] = await Promise.all([
    listTransactions(session.user.agencyId, agentId),
    countTransactionsByStatus(session.user.agencyId, agentId),
    getExchangeForecast(session.user.agencyId, agentId).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId, agentId).catch(() => []),
  ]);

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.status === activeFilter);

  return (
    <>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)", margin: "-28px -20px 0", padding: "24px 20px 28px" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="relative">
          <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">
            {session.user.firmName ?? "Agent Portal"}
          </p>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">My Files</h1>
              <p className="text-sm text-slate-400 mt-0.5">{session.user.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/agent/transactions/new"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
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

      <div className="space-y-7 mt-7">

        {/* Exchanged — awaiting completion */}
        {postExchangeGroups.length > 0 && (
          <PostExchangeStrip groups={postExchangeGroups} basePath="/agent/transactions" />
        )}

        {/* Exchange forecast */}
        {forecastMonths.length > 0 && (
          <ForecastStrip months={forecastMonths} basePath="/agent/transactions" />
        )}

        {/* Filter tabs + transaction list */}
        <div>
          <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-[#e4e9f0] p-1 w-fit shadow-sm">
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
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                    isActive ? "bg-blue-400 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e4e9f0] shadow-sm">
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
      <span className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

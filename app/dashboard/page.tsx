import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listTransactions, countTransactionsByStatus, getExchangeForecast, getExchangedNotCompleting } from "@/lib/services/transactions";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { ForecastStrip } from "@/components/transactions/ForecastStrip";
import { PostExchangeStrip } from "@/components/transactions/PostExchangeStrip";
import { formatDate } from "@/lib/utils";
import type { TransactionStatus } from "@prisma/client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const activeFilter = (filter as TransactionStatus | "all") ?? "all";

  const [transactions, counts, taskCounts, forecastMonths, postExchangeGroups, todoCount] = await Promise.all([
    listTransactions(session.user.agencyId),
    countTransactionsByStatus(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    getExchangeForecast(session.user.agencyId).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId).catch(() => []),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.status === activeFilter);

  return (
    <AppShell session={session} activePath="/dashboard" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <DashboardHero
        userName={session.user.name}
        role={session.user.role}
        counts={counts}
        taskCounts={taskCounts}
        totalFiles={transactions.length}
      />

      <div className="px-8 py-7 space-y-7">

        {/* ── Task summary strip ────────────────────────────────────────── */}
        {taskCounts && taskCounts.pending > 0 && (
          <div className="glass-card px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-900/40 mb-0.5">Open tasks</p>
                <p className="text-2xl font-semibold text-slate-900/90">{taskCounts.pending}</p>
              </div>
              {taskCounts.overdue > 0 && (
                <div>
                  <p className="text-xs text-slate-900/40 mb-0.5">Overdue</p>
                  <p className="text-2xl font-semibold text-orange-500">{taskCounts.overdue}</p>
                </div>
              )}
              {taskCounts.escalated > 0 && (
                <div>
                  <p className="text-xs text-slate-900/40 mb-0.5">Escalated</p>
                  <p className="text-2xl font-semibold text-red-500">{taskCounts.escalated}</p>
                </div>
              )}
              {taskCounts.mine > 0 && (
                <div>
                  <p className="text-xs text-slate-900/40 mb-0.5">Assigned to me</p>
                  <p className="text-2xl font-semibold text-blue-500">{taskCounts.mine}</p>
                </div>
              )}
            </div>
            <Link
              href="/tasks"
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50/60 hover:bg-blue-100/60 rounded-lg transition-colors"
            >
              View work queue →
            </Link>
          </div>
        )}

        {/* ── Exchanged — awaiting completion ──────────────────────────── */}
        {postExchangeGroups.length > 0 && (
          <PostExchangeStrip groups={postExchangeGroups} />
        )}

        {/* ── Exchange forecast ────────────────────────────────────────── */}
        {forecastMonths.length > 0 && (
          <ForecastStrip months={forecastMonths} />
        )}

        {/* ── Filter tabs ───────────────────────────────────────────────── */}
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
                  href={value === "all" ? "/dashboard" : `/dashboard?filter=${value}`}
                  scroll={false}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-slate-900/50 hover:text-slate-900/70 hover:bg-white/40"
                  }`}
                >
                  {label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                    isActive ? "bg-blue-400 text-white" : "bg-white/30 text-slate-900/50"
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
                title={activeFilter === "all" ? "No transactions yet" : `No ${activeFilter.replace("_", " ")} transactions`}
                description={activeFilter === "all" ? "Create your first property transaction to get started." : "Try a different filter."}
                action={
                  activeFilter === "all" ? (
                    <Link
                      href="/transactions/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium text-white transition-colors"
                    >
                      Create transaction
                    </Link>
                  ) : (
                    <Link href="/dashboard" className="text-sm text-blue-500 hover:text-blue-600">
                      View all
                    </Link>
                  )
                }
              />
            </div>
          ) : (
            <TransactionListWithSearch transactions={filtered} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function DashboardHero({
  userName,
  role,
  counts,
  taskCounts,
  totalFiles,
}: {
  userName: string;
  role: string;
  counts: { active: number; on_hold: number; completed: number; withdrawn: number };
  taskCounts: { pending: number; overdue: number } | null;
  totalFiles: number;
}) {
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative px-8 pt-6 pb-7">
        {/* Top row: role label */}
        <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">
          {roleLabel}
        </p>

        {/* Main row: title + CTA */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{userName}</p>
          </div>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white ring-1 ring-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Transaction
          </Link>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 flex-wrap">
          <StatChip value={totalFiles} label="Total files" color="text-white" />
          <div className="w-px h-6 bg-white/10" />
          <StatChip value={counts.active} label="Active" color="text-emerald-400" />
          <StatChip value={counts.on_hold} label="On hold" color="text-amber-400" />
          <StatChip value={counts.completed} label="Completed" color="text-blue-400" />
          {taskCounts && taskCounts.pending > 0 && (
            <>
              <div className="w-px h-6 bg-white/10" />
              <Link href="/tasks" className="group flex items-center gap-2">
                <StatChip
                  value={taskCounts.pending}
                  label={taskCounts.overdue > 0 ? `tasks · ${taskCounts.overdue} overdue` : "tasks pending"}
                  color={taskCounts.overdue > 0 ? "text-orange-400" : "text-slate-300"}
                />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
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

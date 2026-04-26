import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listTransactions, countTransactionsByStatus, getExchangeForecast, getExchangedNotCompleting } from "@/lib/services/transactions";
import { getActiveFlags, FLAG_LABELS } from "@/lib/services/problem-detection";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { FirstSessionCard } from "@/components/dashboard/FirstSessionCard";
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

  const [transactions, counts, taskCounts, forecastMonths, postExchangeGroups, todoCount, attentionFlags] = await Promise.all([
    listTransactions(session.user.agencyId),
    countTransactionsByStatus(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    getExchangeForecast(session.user.agencyId).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId).catch(() => []),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
    getActiveFlags(session.user.agencyId).catch(() => []),
  ]);

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.status === activeFilter);

  const unassignedFiles = transactions.filter(
    (t) => t.serviceType === "outsourced" && t.assignedUser === null && t.status === "active"
  );

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

        {/* ── Unassigned progressor files ───────────────────────────────── */}
        {unassignedFiles.length > 0 && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-800">
                {unassignedFiles.length} file{unassignedFiles.length !== 1 ? "s" : ""} awaiting progressor assignment
              </p>
            </div>
            <div className="space-y-2">
              {unassignedFiles.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 bg-white/60 rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900/80 truncate">{t.propertyAddress}</p>
                    <p className="text-xs text-slate-900/40 mt-0.5">
                      {t.agentUser?.name ? `Submitted by ${t.agentUser.name}` : "Agent submission"}
                    </p>
                  </div>
                  <Link
                    href={`/transactions/${t.id}`}
                    className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
                  >
                    Assign →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── First-session welcome card ── */}
        {transactions.length === 0 && <FirstSessionCard />}

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

        {/* ── Attention needed ─────────────────────────────────────────── */}
        {attentionFlags.length > 0 && (
          <AttentionNeeded flags={attentionFlags} />
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
    <div className="glass-panel-dark relative overflow-hidden">
      <div className="relative px-8 pt-6 pb-7">
        {/* Top row: role label */}
        <p className="glass-section-label text-label-secondary-on-dark mb-4">
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
      <span className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-label-tertiary-on-dark">{label}</span>
    </div>
  );
}

type AttentionFlag = Awaited<ReturnType<typeof getActiveFlags>>[number];

function AttentionNeeded({ flags }: { flags: AttentionFlag[] }) {
  // Group by transaction, keep first flag per transaction
  const byTransaction = new Map<string, { tx: AttentionFlag["transaction"]; flags: AttentionFlag[] }>();
  for (const flag of flags) {
    const entry = byTransaction.get(flag.transaction.id);
    if (entry) {
      entry.flags.push(flag);
    } else {
      byTransaction.set(flag.transaction.id, { tx: flag.transaction, flags: [flag] });
    }
  }

  const flagKindColors: Record<string, string> = {
    long_silence: "bg-amber-50 text-amber-700",
    milestone_stalled: "bg-red-50 text-red-700",
    chase_unanswered: "bg-orange-50 text-orange-700",
    exchange_approaching_gaps: "bg-blue-50 text-blue-700",
    on_hold_extended: "bg-slate-50 text-slate-600",
    no_portal_activity: "bg-purple-50 text-purple-700",
    overdue_milestone: "bg-rose-50 text-rose-700",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <p className="text-sm font-semibold text-slate-900/70">Attention needed</p>
        <span className="text-xs font-medium text-white bg-red-500 rounded-full px-2 py-0.5">{byTransaction.size}</span>
      </div>
      <div className="space-y-2">
        {[...byTransaction.values()].map(({ tx, flags: txFlags }) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="glass-card flex items-start gap-4 px-5 py-4 hover:bg-white/80 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900/80 truncate group-hover:text-blue-600 transition-colors">
                {tx.propertyAddress}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{txFlags[0].reason}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {txFlags.slice(0, 3).map((f) => (
                <span
                  key={f.kind}
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${flagKindColors[f.kind] ?? "bg-slate-50 text-slate-600"}`}
                >
                  {FLAG_LABELS[f.kind as keyof typeof FLAG_LABELS] ?? f.kind}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

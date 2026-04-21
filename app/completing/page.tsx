import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getCompletingFilesDetailed } from "@/lib/services/transactions";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PostExchangeGroupDetailed } from "@/lib/services/transactions";

const urgencyConfig = {
  overdue:   { dot: "bg-red-500",   header: "bg-red-50/40 border-white/20",   label: "text-red-600",   badge: "bg-red-100/80 text-red-700" },
  this_week: { dot: "bg-amber-500", header: "bg-amber-50/40 border-white/20", label: "text-amber-700", badge: "bg-amber-100/80 text-amber-700" },
  next_week: { dot: "bg-blue-500",  header: "bg-blue-50/40 border-white/20",  label: "text-blue-600",  badge: "bg-blue-100/80 text-blue-700" },
  later:     { dot: "bg-slate-400", header: "bg-white/10 border-white/20",    label: "text-slate-900/60", badge: "bg-white/30 text-slate-900/60" },
  no_date:   { dot: "bg-slate-300", header: "bg-white/10 border-white/20",    label: "text-slate-900/50", badge: "bg-white/30 text-slate-900/40" },
};

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

function daysLabel(d: number) {
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  return `${d}d`;
}

function CompletingGroup({ group }: { group: PostExchangeGroupDetailed }) {
  const cfg = urgencyConfig[group.urgency];
  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      <div className={`px-5 py-3 border-b flex items-center gap-2.5 ${cfg.header}`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.label}`}>{group.label}</span>
        <span className="ml-auto text-xs text-slate-900/40">{group.transactions.length} file{group.transactions.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="divide-y divide-white/15">
        {group.transactions.map((tx) => {
          const days = tx.completionDate
            ? Math.round((new Date(tx.completionDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
            : null;

          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}
                  className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 hover:bg-white/20 transition-colors group">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900/90 group-hover:text-blue-600 transition-colors truncate">
                  {tx.propertyAddress}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  {tx.vendors.length > 0 && (
                    <span className="text-xs text-slate-900/40">Vendor: {tx.vendors.join(" & ")}</span>
                  )}
                  {tx.purchasers.length > 0 && (
                    <span className="text-xs text-slate-900/40">Purchaser: {tx.purchasers.join(" & ")}</span>
                  )}
                  {tx.assignedUserName && (
                    <span className="text-xs text-slate-900/30">· {tx.assignedUserName}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  {tx.vendorSolicitorFirmName && (
                    <span className="text-xs text-slate-900/40">V Sol: {tx.vendorSolicitorFirmName}</span>
                  )}
                  {tx.purchaserSolicitorFirmName && (
                    <span className="text-xs text-slate-900/40">P Sol: {tx.purchaserSolicitorFirmName}</span>
                  )}
                  {tx.purchasePrice && (
                    <span className="text-xs text-slate-900/40">{fmt(tx.purchasePrice)}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0">
                {tx.completionDate ? (
                  <>
                    <span className="text-sm font-medium text-slate-900/80">
                      {new Date(tx.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {days !== null && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {daysLabel(days)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-900/30 italic">No date set</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function CompletingPage() {
  const session = await requireSession();
  const [groups, taskCounts, todoCount] = await Promise.all([
    getCompletingFilesDetailed(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const total = groups.reduce((n, g) => n + g.transactions.length, 0);

  return (
    <AppShell session={session} activePath="/completing" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div className="relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}>
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative px-8 pt-6 pb-7 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">Pipeline</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Completing Soon</h1>
            <p className="text-sm text-slate-400 mt-0.5">Exchanged files awaiting completion</p>
          </div>
          {total > 0 && (
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold text-white">{total}</span>
              <span className="text-sm text-slate-400">file{total !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-7 space-y-5">
        {groups.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              title="No files awaiting completion"
              description="Files that have exchanged but not yet completed will appear here."
            />
          </div>
        ) : (
          groups.map((group) => <CompletingGroup key={group.urgency} group={group} />)
        )}
      </div>
    </AppShell>
  );
}

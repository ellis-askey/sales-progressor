import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getGlobalCommsLog } from "@/lib/services/comms";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CommType, CommMethod } from "@prisma/client";

const typeConfig: Record<CommType, { label: string; color: string; dot: string }> = {
  outbound:      { label: "Outbound", color: "bg-blue-50/60 text-blue-700",   dot: "bg-blue-400" },
  inbound:       { label: "Inbound",  color: "bg-emerald-50/60 text-emerald-700", dot: "bg-emerald-400" },
  internal_note: { label: "Note",     color: "bg-white/30 text-slate-900/50",  dot: "bg-slate-300" },
};

const methodLabel: Partial<Record<CommMethod, string>> = {
  email: "Email", phone: "Phone", sms: "SMS",
  voicemail: "Voicemail", whatsapp: "WhatsApp", post: "Post",
};

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function CommsPage() {
  const session = await requireSession();
  const [entries, taskCounts, todoCount] = await Promise.all([
    getGlobalCommsLog(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  return (
    <AppShell session={session} activePath="/comms" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7 flex items-start justify-between">
          <div>
            <p className="glass-section-label text-label-secondary-on-dark mb-4">Activity</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Communications</h1>
            <p className="text-sm text-slate-400 mt-0.5">All recent comms across active files</p>
          </div>
          {entries.length > 0 && (
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold text-white">{entries.length}</span>
              <span className="text-sm text-slate-400">entries</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-7">
        {entries.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              title="No communications yet"
              description="Communications logged against transactions will appear here."
            />
          </div>
        ) : (
          <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
            <div className="divide-y divide-white/15">
              {entries.map((entry) => {
                const cfg = typeConfig[entry.type];
                return (
                  <div key={entry.id} className="px-5 py-3.5 hover:bg-white/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                          <Link href={`/transactions/${entry.transactionId}`}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors truncate max-w-[280px]">
                            {entry.propertyAddress}
                          </Link>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>
                            {cfg.label}{entry.method ? ` · ${methodLabel[entry.method] ?? entry.method}` : ""}
                          </span>
                          {entry.wasAiGenerated && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50/60 text-violet-600 font-medium">AI</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-900/80 line-clamp-2">{entry.content}</p>
                        <p className="text-xs text-slate-900/40 mt-1">{entry.createdByName} · {timeAgo(entry.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

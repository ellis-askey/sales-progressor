import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getGlobalCommsLog } from "@/lib/services/comms";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CommType, CommMethod } from "@prisma/client";

const typeConfig: Record<CommType, { label: string; color: string; dot: string }> = {
  outbound:      { label: "Outbound", color: "bg-blue-50 text-blue-700",   dot: "bg-blue-400" },
  inbound:       { label: "Inbound",  color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  internal_note: { label: "Note",     color: "bg-gray-100 text-gray-500",  dot: "bg-gray-300" },
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
      <div className="relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}>
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative px-8 pt-6 pb-7 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">Activity</p>
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
          <div className="bg-white rounded-xl border border-[#e4e9f0]" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <EmptyState
              title="No communications yet"
              description="Communications logged against transactions will appear here."
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
               style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="divide-y divide-[#f0f4f8]">
              {entries.map((entry) => {
                const cfg = typeConfig[entry.type];
                return (
                  <div key={entry.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
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
                            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">AI</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{entry.content}</p>
                        <p className="text-xs text-gray-400 mt-1">{entry.createdByName} · {timeAgo(entry.createdAt)}</p>
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

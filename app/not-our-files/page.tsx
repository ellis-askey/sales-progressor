import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotOurFilesPage() {
  const session = await requireSession();

  const [transactions, taskCounts, todoCount] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: {
        agencyId: session.user.agencyId,
        progressedBy: "agent",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        purchasePrice: true,
        createdAt: true,
        agentUser: { select: { name: true, email: true } },
        contacts: { select: { name: true, roleType: true } },
        milestoneCompletions: {
          where: { isActive: true, isNotRequired: false },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true, summaryText: true },
        },
      },
    }),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const byAgent = new Map<string, { name: string; email: string; files: typeof transactions }>();
  for (const tx of transactions) {
    const key = tx.agentUser?.email ?? "unknown";
    if (!byAgent.has(key)) {
      byAgent.set(key, { name: tx.agentUser?.name ?? "Unknown agent", email: key, files: [] });
    }
    byAgent.get(key)!.files.push(tx);
  }

  const statusLabel: Record<string, string> = {
    active: "Active",
    on_hold: "On Hold",
    completed: "Completed",
    withdrawn: "Withdrawn",
  };
  const statusColor: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    on_hold: "bg-amber-100 text-amber-700",
    completed: "bg-blue-100 text-blue-700",
    withdrawn: "bg-gray-100 text-gray-500",
  };

  return (
    <AppShell session={session} activePath="/not-our-files" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)", margin: "-28px -20px 0", padding: "24px 20px 28px" }}
      >
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <p className="text-xs text-slate-500 mb-2 font-medium tracking-wide uppercase">Progressor Dashboard</p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Agent-Progressed Files</h1>
          <p className="text-sm text-slate-400 mt-1">Files being self-progressed by agents — read-only overview</p>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-2xl font-semibold text-white">{transactions.length}</span>
            <span className="text-xs text-slate-500">total files</span>
            <div className="w-px h-5 bg-white/10 mx-2" />
            <span className="text-2xl font-semibold text-slate-300">{byAgent.size}</span>
            <span className="text-xs text-slate-500">agent{byAgent.size !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6 mt-7">
        {transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e4e9f0]" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <EmptyState
              title="No agent-progressed files"
              description="When agents choose to self-progress a sale, their files will appear here."
            />
          </div>
        ) : (
          Array.from(byAgent.values()).map((agent) => (
            <div key={agent.email} className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-3 border-b border-[#f0f4f8] bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{agent.name}</p>
                  <p className="text-xs text-gray-400">{agent.email}</p>
                </div>
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  {agent.files.length} file{agent.files.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-[#f0f4f8]">
                {agent.files.map((tx) => {
                  const vendors = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
                  const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);
                  const lastMilestone = tx.milestoneCompletions[0];
                  return (
                    <Link
                      key={tx.id}
                      href={`/transactions/${tx.id}`}
                      className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                          {tx.propertyAddress}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {vendors.length > 0 && <span className="text-xs text-gray-400">Vendor: {vendors.join(" & ")}</span>}
                          {purchasers.length > 0 && <span className="text-xs text-gray-400">Purchaser: {purchasers.join(" & ")}</span>}
                          {tx.purchasePrice && (
                            <span className="text-xs text-gray-300">· £{tx.purchasePrice.toLocaleString("en-GB")}</span>
                          )}
                        </div>
                        {lastMilestone && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            Last: {lastMilestone.summaryText ?? "Milestone completed"} ·{" "}
                            {new Date(lastMilestone.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[tx.status] ?? statusColor.active}`}>
                          {statusLabel[tx.status] ?? tx.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

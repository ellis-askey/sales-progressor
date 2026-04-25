import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotOurFilesPage() {
  const session = await requireSession();

  if (session.user.role === "sales_progressor") {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

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
    active: "bg-emerald-100/80 text-emerald-700",
    on_hold: "bg-amber-100/80 text-amber-700",
    completed: "bg-blue-100/80 text-blue-700",
    withdrawn: "bg-white/30 text-slate-900/50",
  };

  return (
    <AppShell session={session} activePath="/not-our-files" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">Progressor Dashboard</p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Agent-Progressed Files</h1>
          <p className="text-sm text-slate-400 mt-1">Files being self-progressed by agents — read-only overview</p>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-2xl font-semibold text-white">{transactions.length}</span>
            <span className="text-xs text-label-tertiary-on-dark">total files</span>
            <div className="w-px h-5 bg-white/10 mx-2" />
            <span className="text-2xl font-semibold text-slate-300">{byAgent.size}</span>
            <span className="text-xs text-label-tertiary-on-dark">agent{byAgent.size !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 space-y-6">
        {transactions.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              title="No agent-progressed files"
              description="When agents choose to self-progress a sale, their files will appear here."
              icon={
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              }
              iconBg="linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
            />
          </div>
        ) : (
          Array.from(byAgent.values()).map((agent) => (
            <div key={agent.email} className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
              <div className="px-5 py-3 border-b border-white/20 bg-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900/90">{agent.name}</p>
                  <p className="text-xs text-slate-900/40">{agent.email}</p>
                </div>
                <span className="text-xs font-medium bg-white/30 text-slate-900/60 px-2.5 py-1 rounded-full">
                  {agent.files.length} file{agent.files.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-white/15">
                {agent.files.map((tx) => {
                  const vendors = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
                  const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);
                  const lastMilestone = tx.milestoneCompletions[0];
                  return (
                    <Link
                      key={tx.id}
                      href={`/transactions/${tx.id}`}
                      className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 hover:bg-white/20 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900/90 group-hover:text-blue-600 transition-colors truncate">
                          {tx.propertyAddress}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {vendors.length > 0 && <span className="text-xs text-slate-900/40">Vendor: {vendors.join(" & ")}</span>}
                          {purchasers.length > 0 && <span className="text-xs text-slate-900/40">Purchaser: {purchasers.join(" & ")}</span>}
                          {tx.purchasePrice && (
                            <span className="text-xs text-slate-900/30">· £{tx.purchasePrice.toLocaleString("en-GB")}</span>
                          )}
                        </div>
                        {lastMilestone && (
                          <p className="text-xs text-slate-900/40 mt-1 truncate">
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

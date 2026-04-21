// app/admin/page.tsx
// Admin panel: manage agent fee structures

import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentFeeManager } from "@/components/admin/AgentFeeManager";
import { AgentManager } from "@/components/admin/AgentManager";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";

export default async function AdminPage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");

  const [users, agents, progressors, milestoneDefs, reminderRules, todoCount] = await Promise.all([
    prisma.user.findMany({
      where: { agencyId: session.user.agencyId, role: { not: "negotiator" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, clientType: true, legacyFee: true },
    }),
    prisma.user.findMany({
      where: { agencyId: session.user.agencyId, role: "negotiator" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, firmName: true, progressorId: true, _count: { select: { agentFiles: true } } },
    }),
    prisma.user.findMany({
      where: { agencyId: session.user.agencyId, role: "sales_progressor" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.milestoneDefinition.findMany({
      orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    }),
    prisma.reminderRule.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { anchorMilestone: { select: { name: true, code: true } } },
    }),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const vendorDefs = milestoneDefs.filter((d) => d.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((d) => d.side === "purchaser");

  return (
    <AppShell session={session} activePath="/admin" todoCount={todoCount}>
      <PageHeader title="Admin" subtitle="Agency settings and configuration" />
      <div className="px-8 py-7 space-y-10 max-w-5xl">

        {/* Agent accounts */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Agent Accounts</h2>
          <AgentManager agents={agents} progressors={progressors} agencyId={session.user.agencyId} />
        </section>

        {/* Internal user fee structures */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Fee Structures (Internal Users)</h2>
          <AgentFeeManager users={users} />
        </section>

        {/* Milestone definitions */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Milestone Definitions</h2>
          <p className="text-xs text-gray-400 mb-4">Read-only. {milestoneDefs.length} definitions across vendor and purchaser sides.</p>
          <div className="space-y-6">
            {[{ label: "Vendor", defs: vendorDefs }, { label: "Purchaser", defs: purchaserDefs }].map(({ label, defs }) => (
              <div key={label}>
                <p className="text-sm font-medium text-gray-600 mb-2">{label} side</p>
                <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
                     style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#f0f4f8] bg-gray-50">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-12">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Name</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Blocks exch.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Time sensitive</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Exchange gate</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Post exchange</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f4f8]">
                      {defs.map((d) => (
                        <tr key={d.id} className={d.isExchangeGate || d.isPostExchange ? "bg-amber-50/30" : ""}>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{d.orderIndex}</td>
                          <td className="px-4 py-2.5 text-gray-700">{d.name}</td>
                          <td className="px-3 py-2.5 text-center">{d.blocksExchange ? <Flag color="blue" /> : <Dash />}</td>
                          <td className="px-3 py-2.5 text-center">{d.timeSensitive ? <Flag color="amber" /> : <Dash />}</td>
                          <td className="px-3 py-2.5 text-center">{d.isExchangeGate ? <Flag color="green" /> : <Dash />}</td>
                          <td className="px-3 py-2.5 text-center">{d.isPostExchange ? <Flag color="gray" /> : <Dash />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reminder rules */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reminder Rules</h2>
          <p className="text-xs text-gray-400 mb-4">Read-only. {reminderRules.length} active rules.</p>
          <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
               style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f4f8] bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Rule name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Anchor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Target code</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Grace days</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Repeat every</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Escalate after</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Exch. gated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f8]">
                {reminderRules.map((r) => (
                  <tr key={r.id} className={r.requiresExchangeReady ? "bg-green-50/30" : ""}>
                    <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {r.anchorMilestone ? (
                        <span title={r.anchorMilestone.name}>{r.anchorMilestone.code}</span>
                      ) : (
                        <span className="text-gray-300 italic">File creation</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.targetMilestoneCode ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-600">{r.graceDays}d</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-600">{r.repeatEveryDays}d</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-600">{r.escalateAfterChases} chases</td>
                    <td className="px-3 py-2.5 text-center">{r.requiresExchangeReady ? <Flag color="green" /> : <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

function Flag({ color }: { color: "blue" | "amber" | "green" | "gray" }) {
  const cls = {
    blue:  "bg-blue-100 text-blue-600",
    amber: "bg-amber-100 text-amber-600",
    green: "bg-green-100 text-green-600",
    gray:  "bg-gray-100 text-gray-500",
  }[color];
  return (
    <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>✓</span>
  );
}

function Dash() {
  return <span className="text-gray-200 text-xs">—</span>;
}

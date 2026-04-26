// app/admin/page.tsx
// Admin panel: manage agent fee structures

import Link from "next/link";
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
      include: { anchorMilestone: { select: { name: true, code: true, side: true, orderIndex: true } } },
    }),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const vendorDefs = milestoneDefs.filter((d) => d.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((d) => d.side === "purchaser");

  // Sort reminder rules to mirror milestone progression order
  const sortedRules = [...reminderRules].sort((a, b) => {
    const aNull = !a.anchorMilestone;
    const bNull = !b.anchorMilestone;
    if (aNull && bNull) return a.name.localeCompare(b.name);
    if (aNull) return -1;
    if (bNull) return 1;
    const sideOrder = { vendor: 0, purchaser: 1 } as Record<string, number>;
    const aSide = sideOrder[a.anchorMilestone!.side] ?? 0;
    const bSide = sideOrder[b.anchorMilestone!.side] ?? 0;
    if (aSide !== bSide) return aSide - bSide;
    return a.anchorMilestone!.orderIndex - b.anchorMilestone!.orderIndex;
  });

  const fileCreationRules = sortedRules.filter((r) => !r.anchorMilestone);
  const vendorRules       = sortedRules.filter((r) => r.anchorMilestone?.side === "vendor");
  const purchaserRules    = sortedRules.filter((r) => r.anchorMilestone?.side === "purchaser");

  return (
    <AppShell session={session} activePath="/admin" todoCount={todoCount}>
      <PageHeader
        title="Admin"
        subtitle="Agency settings and configuration"
        action={
          <Link href="/admin/audit" className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors font-medium">
            View audit trail →
          </Link>
        }
      />
      <div className="px-8 py-7 space-y-10 max-w-5xl">

        {/* Agent accounts */}
        <section>
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-4">Agent Accounts</h2>
          <AgentManager agents={agents} progressors={progressors} agencyId={session.user.agencyId} />
        </section>

        {/* Internal user fee structures */}
        <section>
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-4">Fee Structures (Internal Users)</h2>
          <AgentFeeManager users={users} />
        </section>

        {/* Milestone definitions */}
        <section>
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Milestone Definitions</h2>
          <p className="text-xs text-white/45 mb-4">Read-only. {milestoneDefs.length} definitions across vendor and purchaser sides.</p>
          <div className="space-y-6">
            {[{ label: "Vendor", defs: vendorDefs }, { label: "Purchaser", defs: purchaserDefs }].map(({ label, defs }) => (
              <div key={label}>
                <p className="text-sm font-medium text-slate-900/60 mb-2">{label} side</p>
                <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 bg-white/10">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40 w-12">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Name</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Blocks exch.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Time sensitive</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Exchange gate</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Post exchange</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/15">
                      {defs.map((d) => (
                        <tr key={d.id} className={d.isExchangeGate || d.isPostExchange ? "bg-amber-50/20" : ""}>
                          <td className="px-4 py-2.5 text-xs text-slate-900/40">{d.orderIndex}</td>
                          <td className="px-4 py-2.5 text-slate-900/80">{d.name}</td>
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
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Reminder Rules</h2>
          <p className="text-xs text-white/45 mb-4">
            Read-only. {reminderRules.length} active rules — ordered by milestone progression.
            Anchor = what must complete to start the reminder. Target = what stops it.
          </p>

          <div className="space-y-6">
            {[
              { label: "Active from file creation", sublabel: "No anchor — triggers immediately on new files", rules: fileCreationRules },
              { label: "Vendor-side triggers",      sublabel: "Unlocked after the anchor vendor milestone completes", rules: vendorRules },
              { label: "Purchaser-side triggers",   sublabel: "Unlocked after the anchor purchaser milestone completes", rules: purchaserRules },
            ].filter(g => g.rules.length > 0).map(({ label, sublabel, rules }) => (
              <div key={label}>
                <p className="text-sm font-medium text-slate-900/60 mb-0.5">{label}</p>
                <p className="text-xs text-white/40 mb-2">{sublabel}</p>
                <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 bg-white/10">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Rule name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Anchor (unlocks reminder)</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Target (stops reminder)</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Grace</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Repeat</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Escalate</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Exch. gated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/15">
                      {rules.map((r) => (
                        <tr key={r.id} className={r.requiresExchangeReady ? "bg-emerald-50/20" : ""}>
                          <td className="px-4 py-2.5 text-slate-900/80">{r.name}</td>
                          <td className="px-4 py-2.5">
                            {r.anchorMilestone ? (
                              <div>
                                <span className="text-xs font-mono font-semibold text-slate-900/60">{r.anchorMilestone.code}</span>
                                <p className="text-xs text-slate-900/40 mt-0.5 leading-tight">{r.anchorMilestone.name}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-900/30 italic">File creation</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.targetMilestoneCode
                              ? <span className="font-mono font-semibold text-slate-900/60">{r.targetMilestoneCode}</span>
                              : <span className="text-slate-900/30">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.graceDays}d</td>
                          <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.repeatEveryDays}d</td>
                          <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.escalateAfterChases} chases</td>
                          <td className="px-3 py-2.5 text-center">{r.requiresExchangeReady ? <Flag color="green" /> : <Dash />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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
    gray:  "bg-white/20 text-slate-900/50",
  }[color];
  return (
    <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>✓</span>
  );
}

function Dash() {
  return <span className="text-slate-900/20 text-xs">—</span>;
}

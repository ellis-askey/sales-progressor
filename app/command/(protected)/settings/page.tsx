import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";

// Command Centre → Settings. Folds the old /admin config into the Command
// Centre: the read-only milestone + reminder-rule reference lives here
// natively; the interactive internal-account + fee editors (and the agency
// audit log) are linked out to /admin, which now also opens for superadmin.

function Flag({ tone }: { tone: "blue" | "green" }) {
  const cls = tone === "blue" ? "text-blue-400 bg-blue-950/50 border-blue-900" : "text-emerald-400 bg-emerald-950/50 border-emerald-900";
  return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>✓</span>;
}
function Dash() {
  return <span className="text-neutral-700 text-xs">·</span>;
}

export default async function SettingsPage() {
  const [milestoneDefs, reminderRules] = await Promise.all([
    commandDb.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] }),
    commandDb.reminderRule.findMany({
      where: { isActive: true },
      include: { anchorMilestone: { select: { name: true, code: true, side: true, orderIndex: true } } },
    }),
  ]);

  const vendorDefs = milestoneDefs.filter((d) => d.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((d) => d.side === "purchaser");

  const sortedRules = [...reminderRules].sort((a, b) => {
    const aNull = !a.anchorMilestone;
    const bNull = !b.anchorMilestone;
    if (aNull && bNull) return a.name.localeCompare(b.name);
    if (aNull) return -1;
    if (bNull) return 1;
    const sideOrder: Record<string, number> = { vendor: 0, purchaser: 1 };
    const aSide = sideOrder[a.anchorMilestone!.side] ?? 0;
    const bSide = sideOrder[b.anchorMilestone!.side] ?? 0;
    if (aSide !== bSide) return aSide - bSide;
    return a.anchorMilestone!.orderIndex - b.anchorMilestone!.orderIndex;
  });
  const fileCreationRules = sortedRules.filter((r) => !r.anchorMilestone);
  const vendorRules = sortedRules.filter((r) => r.anchorMilestone?.side === "vendor");
  const purchaserRules = sortedRules.filter((r) => r.anchorMilestone?.side === "purchaser");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">Your internal team, and how the milestone + reminder engine is set up.</p>
      </div>

      {/* Interactive config lives on /admin (now open to you as superadmin) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/admin" className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 hover:border-neutral-700 transition-colors block">
          <p className="text-sm font-semibold text-neutral-100">Internal team &amp; fees</p>
          <p className="text-[12.5px] text-neutral-500 mt-1">Add or edit internal accounts and their fee structures.</p>
          <span className="text-xs text-blue-400 mt-2 inline-block">Open →</span>
        </Link>
        <Link href="/admin/audit" className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 hover:border-neutral-700 transition-colors block">
          <p className="text-sm font-semibold text-neutral-100">Activity log</p>
          <p className="text-[12.5px] text-neutral-500 mt-1">Every milestone, note, status and message change across files.</p>
          <span className="text-xs text-blue-400 mt-2 inline-block">Open →</span>
        </Link>
      </section>

      {/* Milestone definitions (read-only reference) */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">The steps of a sale</h2>
        <p className="text-[11px] text-neutral-600 mb-4">Read-only. {milestoneDefs.length} steps across the seller and buyer sides.</p>
        <div className="space-y-5">
          {[{ label: "Seller side", defs: vendorDefs }, { label: "Buyer side", defs: purchaserDefs }].map(({ label, defs }) => (
            <div key={label}>
              <p className="text-xs font-medium text-neutral-400 mb-2">{label}</p>
              <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-neutral-950/60">
                      <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500 w-12">#</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Step</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Blocks exchange</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Code</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Can skip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {defs.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5 text-xs text-neutral-500 tabular-nums">{d.orderIndex}</td>
                        <td className="px-4 py-2.5 text-neutral-200 text-xs">{d.name}</td>
                        <td className="px-3 py-2.5 text-center">{d.blocksExchange ? <Flag tone="blue" /> : <Dash />}</td>
                        <td className="px-3 py-2.5 text-xs text-neutral-500 font-mono">{d.code}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-neutral-400">{d.canBeMarkedNr === "never" ? <Dash /> : d.canBeMarkedNr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reminder rules (read-only reference) */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Reminder rules</h2>
        <p className="text-[11px] text-neutral-600 mb-4">
          Read-only. {reminderRules.length} active rules. &ldquo;Starts after&rdquo; is what must be done to begin chasing; &ldquo;stops at&rdquo; is what ends it.
        </p>
        <div className="space-y-5">
          {[
            { label: "From the moment a file is created", rules: fileCreationRules },
            { label: "Seller side", rules: vendorRules },
            { label: "Buyer side", rules: purchaserRules },
          ].filter((g) => g.rules.length > 0).map(({ label, rules }) => (
            <div key={label}>
              <p className="text-xs font-medium text-neutral-400 mb-2">{label}</p>
              <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-neutral-950/60">
                      <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Rule</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Starts after</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Stops at</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Grace</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Repeat</th>
                      <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Escalate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 text-neutral-200 text-xs">{r.name}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.anchorMilestone ? (
                            <div>
                              <span className="text-xs font-mono font-semibold text-neutral-400">{r.anchorMilestone.code}</span>
                              <p className="text-[11px] text-neutral-600 mt-0.5 leading-tight">{r.anchorMilestone.name}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-600 italic">File created</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.targetMilestoneCode ? (
                            <span className="font-mono font-semibold text-neutral-400">{r.targetMilestoneCode}</span>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-neutral-400 tabular-nums">{r.graceDays}d</td>
                        <td className="px-3 py-2.5 text-center text-xs text-neutral-400 tabular-nums">{r.repeatEveryDays}d</td>
                        <td className="px-3 py-2.5 text-center text-xs text-neutral-400 tabular-nums">{r.escalateAfterChases}</td>
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
  );
}

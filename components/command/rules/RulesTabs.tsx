"use client";

// Command Centre → Rules. Two tabs over the read-only engine reference:
// the steps of a sale (milestone definitions) and the reminder rules. Lifted
// out of Settings so each is a dedicated, scannable view rather than one long
// scroll. Read-only — the engine (migrations/seed) stays the source of truth.

import { useState } from "react";

export type MilestoneDefRow = {
  id: string;
  name: string;
  orderIndex: number;
  blocksExchange: boolean;
  code: string;
  canBeMarkedNr: string;
  side: "vendor" | "purchaser";
};

export type ReminderRuleRow = {
  id: string;
  name: string;
  anchor: { code: string; name: string; side: string } | null;
  targetMilestoneCode: string | null;
  graceDays: number;
  repeatEveryDays: number;
  escalateAfterChases: number;
  group: "file" | "vendor" | "purchaser";
};

type Tab = "steps" | "reminders";

function Flag({ tone }: { tone: "blue" | "green" }) {
  const cls = tone === "blue" ? "text-blue-400 bg-blue-950/50 border-blue-900" : "text-emerald-400 bg-emerald-950/50 border-emerald-900";
  return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>✓</span>;
}
function Dash() {
  return <span className="text-neutral-700 text-xs">·</span>;
}

export function RulesTabs({
  milestoneDefs,
  reminderRules,
}: {
  milestoneDefs: MilestoneDefRow[];
  reminderRules: ReminderRuleRow[];
}) {
  const [tab, setTab] = useState<Tab>("steps");

  const vendorDefs = milestoneDefs.filter((d) => d.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((d) => d.side === "purchaser");

  const fileRules = reminderRules.filter((r) => r.group === "file");
  const vendorRules = reminderRules.filter((r) => r.group === "vendor");
  const purchaserRules = reminderRules.filter((r) => r.group === "purchaser");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-[3px] w-fit">
        {([
          { key: "steps" as Tab, label: `The steps of a sale (${milestoneDefs.length})` },
          { key: "reminders" as Tab, label: `Reminder rules (${reminderRules.length})` },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-md transition-colors ${
              tab === t.key
                ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Steps of a sale ─────────────────────────────────────────────── */}
      {tab === "steps" && (
        <section>
          <p className="text-[11px] text-neutral-600 mb-4">
            Read-only. {milestoneDefs.length} steps across the seller and buyer sides. The engine is the source of truth.
          </p>
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
      )}

      {/* ── Reminder rules ──────────────────────────────────────────────── */}
      {tab === "reminders" && (
        <section>
          <p className="text-[11px] text-neutral-600 mb-4">
            Read-only. {reminderRules.length} active rules. &ldquo;Starts after&rdquo; is what must be done to begin chasing; &ldquo;stops at&rdquo; is what ends it.
          </p>
          <div className="space-y-5">
            {[
              { label: "From the moment a file is created", rules: fileRules },
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
                            {r.anchor ? (
                              <div>
                                <span className="text-xs font-mono font-semibold text-neutral-400">{r.anchor.code}</span>
                                <p className="text-[11px] text-neutral-600 mt-0.5 leading-tight">{r.anchor.name}</p>
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
      )}
    </div>
  );
}

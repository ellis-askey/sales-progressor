"use client";

import { useState, useMemo, useEffect } from "react";
import { MilestoneRow } from "@/components/milestones/MilestoneRow";
import { NotRequiredRow } from "@/components/milestones/NotRequiredRow";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";

const SECTION_COLORS: Record<string, { dot: string; label: string }> = {
  "Onboarding":            { dot: "bg-blue-400",    label: "text-blue-600"    },
  "Finances":              { dot: "bg-violet-400",  label: "text-violet-600"  },
  "Surveys":               { dot: "bg-sky-400",     label: "text-sky-600"     },
  "Conveyancing":          { dot: "bg-amber-400",   label: "text-amber-700"   },
  "Exchange & Completion": { dot: "bg-emerald-500", label: "text-emerald-700" },
};

const VENDOR_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["VM1","VM2","VM3","VM4","VM5","VM6"] },
  { label: "Conveyancing",          codes: ["VM7","VM8","VM9","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17"] },
  { label: "Exchange & Completion", codes: ["VM18","VM19","VM20"] },
];

const PURCHASER_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["PM1","PM2","PM3","PM4"] },
  { label: "Finances",              codes: ["PM5","PM6","PM11","PM9","PM10"] },
  { label: "Conveyancing",          codes: ["PM7","PM8","PM12","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24"] },
  { label: "Exchange & Completion", codes: ["PM25","PM26","PM27"] },
];

type EnrichedDef = Omit<MilestoneDefinition, "weight"> & {
  weight: number;
  completion: MilestoneCompletion | null;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

type Props = {
  transactionId: string;
  vendor: EnrichedDef[];
  purchaser: EnrichedDef[];
  exchangeReady: boolean;
  vendorGateReady: boolean;
  purchaserGateReady: boolean;
};

export function MilestonePanel({
  transactionId,
  vendor,
  purchaser,
  exchangeReady,
  vendorGateReady,
  purchaserGateReady,
}: Props) {
  const [activeTab, setActiveTab] = useState<"vendor" | "purchaser">("vendor");

  const milestones = activeTab === "vendor" ? vendor : purchaser;
  const gateReady = activeTab === "vendor" ? vendorGateReady : purchaserGateReady;

  const allMilestoneLookup = useMemo(() => {
    const lookup = new Map<string, EnrichedDef>();
    for (const m of vendor) lookup.set(m.code, m);
    for (const m of purchaser) lookup.set(m.code, m);
    return lookup;
  }, [vendor, purchaser]);

  function getCounterpartNotice(code: string): string | undefined {
    if (code === "VM19") {
      const pm25 = allMilestoneLookup.get("PM25");
      if (pm25 && !pm25.isComplete && !pm25.isNotRequired) {
        return `Both sides must be ready to exchange before exchange can be confirmed. The purchaser side is still at "${pm25.name}".`;
      }
    } else if (code === "PM26") {
      const vm18 = allMilestoneLookup.get("VM18");
      if (vm18 && !vm18.isComplete && !vm18.isNotRequired) {
        return `Both sides must be ready to exchange before exchange can be confirmed. The vendor side is still at "${vm18.name}".`;
      }
    } else if (code === "VM20" || code === "PM27") {
      const vm19 = allMilestoneLookup.get("VM19");
      const pm26 = allMilestoneLookup.get("PM26");
      if ((vm19 && !vm19.isComplete) || (pm26 && !pm26.isComplete)) {
        return "Both sides need to confirm exchange before you can mark completion.";
      }
    }
    return undefined;
  }
  const sectionDefs = activeTab === "vendor" ? VENDOR_SECTIONS : PURCHASER_SECTIONS;

  const nrMilestones = milestones.filter((m) => m.isNotRequired);

  const initialCollapsed = useMemo(() => {
    const state: Record<string, boolean> = {};
    for (const section of sectionDefs) {
      const codeSet = new Set(section.codes);
      const rows = milestones.filter((m) => codeSet.has(m.code) && !m.isNotRequired);
      state[section.label] = rows.length > 0 && rows.every((m) => m.isComplete);
    }
    return state;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(initialCollapsed);
  const [nrCollapsed, setNrCollapsed] = useState(true);
  const [optimisticallyUnlockedIds, setOptimisticallyUnlockedIds] = useState<Set<string>>(new Set());
  const [optimisticallyRelockedIds, setOptimisticallyRelockedIds] = useState<Set<string>>(new Set());

  // Clear optimistic state once the server data arrives with the real unlock/relock
  useEffect(() => {
    setOptimisticallyUnlockedIds(new Set());
    setOptimisticallyRelockedIds(new Set());
  }, [vendor, purchaser]);

  function handleTabChange(side: "vendor" | "purchaser") {
    setActiveTab(side);
    const secs = side === "vendor" ? VENDOR_SECTIONS : PURCHASER_SECTIONS;
    const mils = side === "vendor" ? vendor : purchaser;
    const next: Record<string, boolean> = {};
    for (const s of secs) {
      const codeSet = new Set(s.codes);
      const rows = mils.filter((m) => codeSet.has(m.code) && !m.isNotRequired);
      next[s.label] = rows.length > 0 && rows.every((m) => m.isComplete);
    }
    setCollapsed(next);
  }

  function toggleSection(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  // Shared: after a milestone is confirmed or NR'd, unlock any dependent that is
  // now fully satisfied. Called by handleConfirmStart and handleNRStart.
  function unlockDependents(doneId: string, doneCode: string) {
    const codeToId = new Map(milestones.map((m) => [m.code, m.id]));
    const satisfiedIds = new Set(
      milestones.filter((m) => m.isComplete || m.isNotRequired).map((m) => m.id)
    );
    satisfiedIds.add(doneId);

    const toUnlock: string[] = [];
    for (const m of milestones) {
      if (m.isComplete || m.isNotRequired || m.isAvailable) continue;
      const prereqs = DIRECT_PREREQUISITES[m.code] ?? [];
      if (!prereqs.includes(doneCode)) continue;
      const allMet = prereqs.every((p) => {
        const pid = codeToId.get(p);
        return pid ? satisfiedIds.has(pid) : true;
      });
      if (allMet) toUnlock.push(m.id);
    }
    if (toUnlock.length > 0) {
      setOptimisticallyUnlockedIds((prev) => new Set([...prev, ...toUnlock]));
    }
  }

  function handleConfirmStart(confirmedId: string, confirmedCode: string) {
    unlockDependents(confirmedId, confirmedCode);
  }

  // N/R counts as "satisfied" for prereq purposes — same cascade as Confirm.
  function handleNRStart(nrId: string, nrCode: string) {
    unlockDependents(nrId, nrCode);
  }

  // After undoing a milestone, re-lock any dependent that is now no longer
  // fully satisfied. Only affects available (not yet confirmed) dependents.
  function handleUndoStart(undoneId: string, undoneCode: string) {
    const toRelock: string[] = [];
    for (const m of milestones) {
      if (m.isComplete || m.isNotRequired || !m.isAvailable) continue;
      const prereqs = DIRECT_PREREQUISITES[m.code] ?? [];
      if (prereqs.includes(undoneCode)) toRelock.push(m.id);
    }
    if (toRelock.length > 0) {
      setOptimisticallyRelockedIds((prev) => new Set([...prev, ...toRelock]));
    }
    // The undone milestone itself loses its "complete" status — remove from unlocked set
    setOptimisticallyUnlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(undoneId);
      return next;
    });
  }

  const applicableMs = milestones.filter((m) => !m.isNotRequired);
  const totalAll = applicableMs.length;
  const doneAll = applicableMs.filter((m) => m.isComplete).length;
  const applicableWeight = applicableMs.reduce((s, m) => s + Number(m.weight), 0);
  const completedWeight = applicableMs.filter((m) => m.isComplete).reduce((s, m) => s + Number(m.weight), 0);
  const progressPct = applicableWeight > 0 ? Math.round((completedWeight / applicableWeight) * 100) : 100;

  const barGradient =
    progressPct < 40
      ? "linear-gradient(90deg, #818cf8 0%, #60a5fa 100%)"
      : progressPct < 75
      ? "linear-gradient(90deg, #60a5fa 0%, #34d399 100%)"
      : "linear-gradient(90deg, #34d399 0%, #10b981 100%)";

  return (
    <section>
      <style>{`
        @keyframes ms-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .ms-shimmer-anim { animation: ms-shimmer 2.4s ease-in-out infinite; }

        @keyframes ms-node-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          55%  { transform: scale(1.12); opacity: 1; }
          75%  { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        .ms-node-pop { animation: ms-node-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes ms-node-unlock {
          0%   { transform: scale(0.55); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        .ms-node-unlock { animation: ms-node-unlock 340ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes ms-btn-appear {
          0%   { opacity: 0; transform: translateX(-6px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .ms-btn-appear { animation: ms-btn-appear 220ms ease-out 120ms both; }

        @media (prefers-reduced-motion: reduce) {
          .ms-node-pop, .ms-unlock-enter, .ms-node-unlock, .ms-btn-appear { animation: none; }
        }
      `}</style>

      {/* ── Exchange readiness banner ──────────────────────────────────── */}
      {exchangeReady ? (
        <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center gap-3 animate-enter">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">Ready to exchange</p>
            <p className="text-xs text-green-600">All blocking steps are complete on both sides</p>
          </div>
        </div>
      ) : (
        <div className="glass-card mb-5 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">Exchange progress</span>
            <span className="text-lg font-bold tabular-nums" style={{ color: progressPct >= 75 ? "#10b981" : progressPct >= 40 ? "#3b82f6" : "#6366f1" }}>
              {progressPct}%
            </span>
          </div>
          <div className="h-3.5 bg-slate-900/8 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out relative overflow-hidden"
              style={{
                width: `${Math.max(progressPct, 2)}%`,
                background: barGradient,
                boxShadow: progressPct > 5 ? "0 0 10px rgba(99,102,241,0.35)" : "none",
              }}
            >
              <div
                className="ms-shimmer-anim absolute inset-y-0 w-1/3"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-900/40 mt-2">{doneAll} of {totalAll} steps complete</p>
        </div>
      )}

      {/* ── Side tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        {(["vendor", "purchaser"] as const).map((side) => {
          const mils = side === "vendor" ? vendor : purchaser;
          const applicable = mils.filter((m) => !m.isNotRequired);
          const done = applicable.filter((m) => m.isComplete).length;
          const total = applicable.length;
          const gateOk = side === "vendor" ? vendorGateReady : purchaserGateReady;
          return (
            <button
              key={side}
              onClick={() => handleTabChange(side)}
              className={`agent-segment-pill${activeTab === side ? " on" : ""}`}
            >
              <span className="capitalize">{side}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                gateOk
                  ? "bg-emerald-100/80 text-emerald-700"
                  : activeTab === side
                  ? "bg-blue-50/80 text-blue-600"
                  : "bg-white/30 text-slate-900/50"
              }`}>
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Milestone list ────────────────────────────────────────────── */}
      {milestones.length === 0 ? (
        <div className="glass-card px-5 py-8 text-center text-sm text-slate-900/40">
          No milestones found
        </div>
      ) : (
        <div className="space-y-3">
          {sectionDefs.map((section) => {
            const sc = SECTION_COLORS[section.label] ?? SECTION_COLORS["Onboarding"];
            const codeSet = new Set(section.codes);
            const rows = milestones
              .filter((m) => codeSet.has(m.code) && !m.isNotRequired)
              .sort((a, b) => section.codes.indexOf(a.code) - section.codes.indexOf(b.code));
            const allInSection = milestones.filter((m) => codeSet.has(m.code));
            if (allInSection.length === 0) return null;
            const sectionDone = allInSection.filter((m) => m.isComplete || m.isNotRequired).length;
            const allDone = sectionDone === allInSection.length;
            const isCollapsed = collapsed[section.label] ?? false;

            return (
              <div key={section.label}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className={`w-full flex items-center gap-2.5 rounded-xl transition-all group agent-acc-hdr ${
                    isCollapsed && allDone
                      ? "bg-emerald-50/60 border border-emerald-100/60"
                      : "bg-transparent"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allDone ? "bg-emerald-400" : sc.dot}`} />
                  <span className="agent-acc-title">
                    {section.label}
                  </span>
                  {!(isCollapsed && allDone) && <div className="flex-1 h-px bg-white/30" />}
                  {isCollapsed && allDone && <div className="flex-1" />}
                  <span className="agent-badge">
                    {allDone ? "All done" : `${sectionDone}/${allInSection.length}`}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-900/30 group-hover:text-slate-900/60 transition-transform flex-shrink-0 ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                <div className={`agent-acc ${!isCollapsed ? "open" : ""}`}>
                  <div className="agent-acc-in">
                    {rows.length > 0 ? (
                      <div className="glass-card relative mt-1 rounded-[12px] overflow-hidden">
                        <div className="absolute left-[26px] top-6 bottom-6 w-px bg-white/30" />
                        {rows.map((def) => (
                          <MilestoneRow
                            key={def.id}
                            def={def}
                            transactionId={transactionId}
                            onConfirmStart={() => handleConfirmStart(def.id, def.code)}
                            optimisticallyAvailable={optimisticallyUnlockedIds.has(def.id)}
                            optimisticallyRelocked={optimisticallyRelockedIds.has(def.id)}
                            onNRStart={() => handleNRStart(def.id, def.code)}
                            onUndoStart={() => handleUndoStart(def.id, def.code)}
                            counterpartNotice={getCounterpartNotice(def.code)}
                          />
                        ))}
                      </div>
                    ) : allInSection.length > 0 ? (
                      <div className="mt-1 px-4 py-3 glass-subtle rounded-xl text-xs text-slate-900/40 italic">
                        All steps in this section are skipped
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Not required section ──────────────────────────────────── */}
          {nrMilestones.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setNrCollapsed((p) => !p)}
                className="w-full flex items-center gap-2.5 transition-all group glass-subtle agent-acc-hdr"
              >
                <div className="w-2 h-2 rounded-full bg-slate-900/20 flex-shrink-0" />
                <span className="agent-acc-title">Skipped</span>
                <span className="agent-badge">{nrMilestones.length}</span>
                <div className="flex-1" />
                <svg
                  className={`w-3.5 h-3.5 text-slate-900/30 group-hover:text-slate-900/60 transition-transform flex-shrink-0 ${nrCollapsed ? "" : "rotate-180"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              <div className={`agent-acc ${!nrCollapsed ? "open" : ""}`}>
                <div className="agent-acc-in">
                  <div className="glass-card mt-1 rounded-[12px] overflow-hidden">
                    {nrMilestones.map((def) => (
                      <NotRequiredRow key={def.id} def={def} transactionId={transactionId} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gateReady && (
        <p className="mt-3 text-xs text-emerald-600 text-center">
          ✓ {activeTab === "vendor" ? "Vendor" : "Purchaser"} side ready — exchange gate step is now available
        </p>
      )}
    </section>
  );
}

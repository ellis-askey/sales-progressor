"use client";

import { useState, useMemo, useEffect } from "react";
import { MilestoneRow } from "@/components/milestones/MilestoneRow";
import { NotRequiredRow } from "@/components/milestones/NotRequiredRow";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";

const SECTION_COLORS: Record<string, { dot: string; label: string }> = {
  "Onboarding":            { dot: "bg-blue-400",    label: "text-blue-600"    },
  "Finances":              { dot: "bg-violet-400",  label: "text-violet-600"  },
  "Surveys":               { dot: "bg-sky-400",     label: "text-sky-600"     },
  "Conveyancing":          { dot: "bg-amber-400",   label: "text-amber-700"   },
  "Exchange & Completion": { dot: "bg-emerald-500", label: "text-emerald-700" },
};

const VENDOR_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["VM1","VM2","VM3","VM14","VM15","VM4"] },
  { label: "Conveyancing",          codes: ["VM5","VM6","VM7","VM16","VM17","VM8","VM18","VM19","VM9"] },
  { label: "Exchange & Completion", codes: ["VM10","VM11","VM20","VM12","VM13"] },
];

const PURCHASER_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["PM1","PM2","PM14a","PM15a"] },
  { label: "Finances",              codes: ["PM4","PM5","PM6"] },
  { label: "Surveys",               codes: ["PM7","PM20"] },
  { label: "Conveyancing",          codes: ["PM3","PM9","PM8","PM10","PM11","PM21","PM22","PM12","PM23","PM24","PM25"] },
  { label: "Exchange & Completion", codes: ["PM26","PM13","PM14b","PM15b","PM27","PM16","PM17"] },
];

type EnrichedDef = MilestoneDefinition & {
  activeCompletion: MilestoneCompletion | null;
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

  useEffect(() => {
    setOptimisticallyUnlockedIds(new Set());
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

  const orderedRows = useMemo(() => {
    const result: EnrichedDef[] = [];
    for (const section of sectionDefs) {
      const codeSet = new Set(section.codes);
      const rows = milestones
        .filter((m) => codeSet.has(m.code) && !m.isNotRequired)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      result.push(...rows);
    }
    return result;
  }, [milestones, sectionDefs]);

  function handleConfirmStart(currentId: string) {
    const currentIdx = orderedRows.findIndex((m) => m.id === currentId);
    if (currentIdx === -1) return;
    const next = orderedRows.slice(currentIdx + 1).find(
      (m) => !m.isComplete && !m.isNotRequired && !m.isAvailable
    );
    if (next) {
      setOptimisticallyUnlockedIds((prev) => new Set([...prev, next.id]));
    }
  }

  const totalAll = milestones.length;
  const doneAll = milestones.filter((m) => m.isComplete || m.isNotRequired).length;
  const progressPct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

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

        @keyframes ms-unlock {
          0%   { box-shadow: inset 3px 0 0 rgba(59,130,246,0.9); background: rgba(59,130,246,0.08); }
          55%  { box-shadow: inset 3px 0 0 rgba(59,130,246,0.3); background: rgba(59,130,246,0.03); }
          100% { box-shadow: none; background: transparent; }
        }
        .ms-unlock-enter { animation: ms-unlock 900ms ease-out both; }

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
            <p className="text-xs text-green-600">All blocking milestones are complete on both sides</p>
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
          <p className="text-xs text-slate-900/40 mt-2">{doneAll} of {totalAll} milestones complete</p>
        </div>
      )}

      {/* ── Side tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 glass-subtle p-1 w-fit">
        {(["vendor", "purchaser"] as const).map((side) => {
          const mils = side === "vendor" ? vendor : purchaser;
          const done = mils.filter((m) => m.isComplete || m.isNotRequired).length;
          const total = mils.length;
          const gateOk = side === "vendor" ? vendorGateReady : purchaserGateReady;
          return (
            <button
              key={side}
              onClick={() => handleTabChange(side)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === side
                  ? "bg-white/60 text-slate-900/90 shadow-sm"
                  : "text-slate-900/50 hover:text-slate-900/70"
              }`}
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
              .sort((a, b) => a.orderIndex - b.orderIndex);
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group ${
                    isCollapsed && allDone
                      ? "bg-emerald-50/60 border border-emerald-100/60"
                      : "bg-transparent"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allDone ? "bg-emerald-400" : sc.dot}`} />
                  <span className="glass-section-label text-slate-900/60">
                    {section.label}
                  </span>
                  {!(isCollapsed && allDone) && <div className="flex-1 h-px bg-white/30" />}
                  {isCollapsed && allDone && <div className="flex-1" />}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    allDone ? "bg-emerald-100/80 text-emerald-700" : "bg-white/30 text-slate-900/40"
                  }`}>
                    {allDone ? "All done" : `${sectionDone}/${allInSection.length}`}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-900/30 group-hover:text-slate-900/60 transition-transform flex-shrink-0 ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {!isCollapsed && rows.length > 0 && (
                  <div className="glass-card relative mt-1 rounded-[20px] overflow-hidden">
                    <div className="absolute left-[26px] top-6 bottom-6 w-px bg-white/30" />
                    {rows.map((def) => (
                      <MilestoneRow
                        key={def.id}
                        def={def}
                        transactionId={transactionId}
                        onConfirmStart={() => handleConfirmStart(def.id)}
                        optimisticallyAvailable={optimisticallyUnlockedIds.has(def.id)}
                      />
                    ))}
                  </div>
                )}

                {!isCollapsed && rows.length === 0 && allInSection.length > 0 && (
                  <div className="mt-1 px-4 py-3 glass-subtle rounded-xl text-xs text-slate-900/40 italic">
                    All milestones in this section are not required
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Not required section ──────────────────────────────────── */}
          {nrMilestones.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setNrCollapsed((p) => !p)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group glass-subtle"
              >
                <div className="w-2 h-2 rounded-full bg-slate-900/20 flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-900/40">
                  Not required
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/30 text-slate-900/40">
                  {nrMilestones.length}
                </span>
                <div className="flex-1" />
                <svg
                  className={`w-3.5 h-3.5 text-slate-900/30 group-hover:text-slate-900/60 transition-transform flex-shrink-0 ${nrCollapsed ? "" : "rotate-180"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {!nrCollapsed && (
                <div className="glass-card mt-1" style={{ clipPath: "inset(0 round 20px)" }}>
                  {nrMilestones.map((def) => (
                    <NotRequiredRow key={def.id} def={def} transactionId={transactionId} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {gateReady && (
        <p className="mt-3 text-xs text-emerald-600 text-center">
          ✓ {activeTab === "vendor" ? "Vendor" : "Purchaser"} side ready — exchange gate milestone is now available
        </p>
      )}
    </section>
  );
}

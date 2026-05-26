"use client";

import { useState, useMemo, useEffect } from "react";
import { MilestoneRow } from "@/components/milestones/MilestoneRow";
import { NotRequiredRow } from "@/components/milestones/NotRequiredRow";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { buildCompletionLookup, computeSlowness, computeStaleness, MEDIANS_READY } from "@/lib/services/milestone-staleness";
import type { AggregatedClientChase } from "@/lib/services/client-chase-state";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";
import { VENDOR_SECTIONS, PURCHASER_SECTIONS } from "@/lib/milestone-sections";
import { NR_CASCADE } from "@/lib/milestone-nr-cascade";

const SECTION_COLORS: Record<string, { dot: string; label: string }> = {
  "Onboarding":            { dot: "bg-blue-400",    label: "text-blue-600"    },
  "Finances":              { dot: "bg-violet-400",  label: "text-violet-600"  },
  "Surveys":               { dot: "bg-sky-400",     label: "text-sky-600"     },
  "Conveyancing":          { dot: "bg-amber-400",   label: "text-amber-700"   },
  "Exchange & Completion": { dot: "bg-emerald-500", label: "text-emerald-700" },
};

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
  // Map of milestone code → graceDays from active ReminderRules (server-fetched
  // once per page load via getGraceDaysByMilestoneCode). Drives the staleness
  // badge — codes absent from this map get no badge. Plain object on the wire
  // since Maps don't serialise across server→client boundaries cleanly.
  graceDaysByCode?: Record<string, number>;
  // Map of milestone code → aggregated client-chase state for the
  // transaction (B6 of the client-chase arc). When present and a row
  // matches the code, MilestoneRow renders the chase-status chip. Codes
  // absent from this map get no chip. Optional — the agent transaction
  // page doesn't pass it yet (collision-blocked; tracked as a follow-up
  // in docs/active/client-chase-discovery.md). The chip renders silently
  // when the wiring lands.
  clientChaseByCode?: Record<string, AggregatedClientChase>;
};

export function MilestonePanel({
  transactionId,
  vendor,
  purchaser,
  exchangeReady,
  vendorGateReady,
  purchaserGateReady,
  graceDaysByCode,
  clientChaseByCode,
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

  // Pool both sides for the slowness lookup — a purchaser milestone can
  // depend on a vendor completion (PM12 ← VM9). Built once per render.
  const completionLookup = useMemo(
    () => buildCompletionLookup([...vendor, ...purchaser]),
    [vendor, purchaser],
  );

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
  // Optimistic-NR-cascade: when the user N/Rs a milestone whose code maps
  // to downstream codes in NR_CASCADE (e.g. PM9 → PM10), the downstream
  // rows should disappear in the same render — not after a server round-
  // trip. MilestoneRow already handles its OWN optimistic NR via
  // useOptimistic; this set propagates to the cascade siblings.
  const [optimisticallyNotRequiredIds, setOptimisticallyNotRequiredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOptimisticallyUnlockedIds(new Set());
    setOptimisticallyRelockedIds(new Set());
    setOptimisticallyNotRequiredIds(new Set());
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

  function handleNRStart(nrId: string, nrCode: string) {
    unlockDependents(nrId, nrCode);
    // Cascade-NR any downstream milestones flagged in NR_CASCADE (e.g.
    // PM9 → PM10). The server's markNotRequiredWithCascade applies the
    // same mapping; this set just mirrors that decision on the client
    // so the rows hide instantly instead of lingering for the round-trip.
    const cascadeCodes = NR_CASCADE[nrCode] ?? [];
    if (cascadeCodes.length > 0) {
      const codeToId = new Map(milestones.map((m) => [m.code, m.id]));
      const cascadeIds = cascadeCodes
        .map((c) => codeToId.get(c))
        .filter((id): id is string => !!id);
      if (cascadeIds.length > 0) {
        setOptimisticallyNotRequiredIds((prev) => new Set([...prev, ...cascadeIds]));
      }
    }
  }

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

  return (
    <section>
      {/* ── Exchange readiness banner ──────────────────────────────────────────── */}
      {exchangeReady ? (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[var(--agent-success-bg)] border border-[var(--agent-success-border)] flex items-center gap-3 agent-reveal-in">
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
        /* ── Progress bar card ───────────────────────────────────────────────── */
        <div className="glass-card mb-4" style={{ padding: "14px 16px", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Exchange progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--agent-text-primary)" }}>{progressPct}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(30,45,74,.08)", borderRadius: 3, overflow: "hidden" }}>
            {progressPct >= 100 ? (
              <div style={{ width: "100%", height: "100%", borderRadius: 3, background: "#10b981" }} />
            ) : (
              <div
                className="ms-bar-shimmer"
                style={{ width: `${Math.max(progressPct, 2)}%`, height: "100%", borderRadius: 3, transition: "width 700ms ease-out" }}
              />
            )}
          </div>
          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>{doneAll} of {totalAll} steps complete</p>
        </div>
      )}

      {/* ── Side tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        {(["vendor", "purchaser"] as const).map((side) => {
          const mils = side === "vendor" ? vendor : purchaser;
          const applicable = mils.filter((m) => !m.isNotRequired);
          const done = applicable.filter((m) => m.isComplete).length;
          const total = applicable.length;
          return (
            <button
              key={side}
              onClick={() => handleTabChange(side)}
              className={`agent-segment-pill agent-segment-pill-sm${activeTab === side ? " on" : ""}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <RoleIcon role={side} size={12} colorOverride={activeTab === side ? "currentColor" : undefined} />
              <span className="capitalize">{side}</span>
              <span className="agent-segment-pill-note">{done}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* ── Milestone list ─────────────────────────────────────────────────────── */}
      {milestones.length === 0 ? (
        <div className="glass-card px-5 py-8 text-center text-sm text-slate-900/40">
          No milestones found
        </div>
      ) : (
        <div className="space-y-3">
          {sectionDefs.map((section) => {
            const sc = SECTION_COLORS[section.label] ?? SECTION_COLORS["Onboarding"];
            const codeSet = new Set(section.codes);
            // Hide rows that are server-NR'd OR optimistically cascade-NR'd
            // (see optimisticallyNotRequiredIds — kicks in the moment the
            // user confirms N/R on a parent milestone like PM9).
            const rows = milestones
              .filter((m) => codeSet.has(m.code) && !m.isNotRequired && !optimisticallyNotRequiredIds.has(m.id))
              .sort((a, b) => section.codes.indexOf(a.code) - section.codes.indexOf(b.code));
            const allInSection = milestones.filter((m) => codeSet.has(m.code));
            if (allInSection.length === 0) return null;
            const sectionDone = allInSection.filter((m) => m.isComplete || m.isNotRequired || optimisticallyNotRequiredIds.has(m.id)).length;
            const allDone = sectionDone === allInSection.length;
            const isCollapsed = collapsed[section.label] ?? false;

            return (
              <div key={section.label} className="glass-card overflow-hidden rounded-[12px]">
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className="agent-acc-hdr w-full"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${allDone ? "bg-emerald-400" : sc.dot}`} />
                    <span className="agent-acc-title">{section.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="agent-badge">{allDone ? "All done" : `${sectionDone}/${allInSection.length}`}</span>
                    <svg
                      className={`w-3.5 h-3.5 text-slate-900/30 transition-transform flex-shrink-0 ${isCollapsed ? "" : "rotate-180"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                <div className={`agent-acc${!isCollapsed ? " open" : ""}`}>
                  <div className="agent-acc-in">
                    {rows.length > 0 ? (
                      rows.map((def) => {
                        // Slowness signal: only for rows that are currently
                        // available + not done. Computed once per render from
                        // the pooled completion lookup.
                        const showSlowness =
                          def.isAvailable && !def.isComplete && !def.isNotRequired;
                        const slownessSignal = (showSlowness && MEDIANS_READY)
                          ? computeSlowness(def.code, completionLookup)
                          : null;
                        // Staleness signal: separate from slowness. Threshold
                        // is the configured ReminderRule.graceDays, not a
                        // learned median, so it's safe to show without
                        // MEDIANS_READY. Same eligibility gate as slowness
                        // (available + not done + not NR).
                        const stalenessSignal = showSlowness
                          ? computeStaleness(def.code, completionLookup, graceDaysByCode?.[def.code])
                          : null;
                        // Client-chase chip: same eligibility gate (avail-
                        // able + not done + not NR). Renders only when the
                        // map supplies a non-null entry for this code.
                        const clientChase = showSlowness
                          ? clientChaseByCode?.[def.code] ?? null
                          : null;
                        return (
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
                            slownessSignal={slownessSignal}
                            stalenessSignal={stalenessSignal}
                            clientChase={clientChase}
                          />
                        );
                      })
                    ) : allInSection.length > 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-900/40 italic">
                        All steps in this section are skipped
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Skipped / Not-required section ──────────────────────────────── */}
          {nrMilestones.length > 0 && (
            <div className="glass-card overflow-hidden rounded-[12px]">
              <button
                type="button"
                onClick={() => setNrCollapsed((p) => !p)}
                className="agent-acc-hdr w-full"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="w-2 h-2 rounded-full bg-slate-900/20 flex-shrink-0" />
                  <span className="agent-acc-title">Skipped</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="agent-badge">{nrMilestones.length}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-900/30 transition-transform flex-shrink-0 ${nrCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>
              <div className={`agent-acc${!nrCollapsed ? " open" : ""}`}>
                <div className="agent-acc-in">
                  {nrMilestones.map((def) => (
                    <NotRequiredRow key={def.id} def={def} transactionId={transactionId} />
                  ))}
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

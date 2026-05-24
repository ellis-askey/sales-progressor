"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { RoleIcon, type Role } from "@/components/ui/RoleIcon";

// Reusable milestone reconciliation picker.
// Renders vendor + purchaser sections with checkbox + optional date input per row.
// Filters out auto-NR codes based on the file's tenure / purchaseType so the agent
// only sees milestones that are actually relevant.
//
// Cross-side cascade: ticking a milestone with a bilateral counterpart on the other
// side auto-fills the counterpart with the same date. Agent can override either
// side; once they manually edit a cascaded row, the link breaks.
//
// Used by:
//   - components/claim/ClaimConfirmForm.tsx (initial claim-time reconciliation)
//   - components/claim/ClaimSignupForm.tsx (new-user claim-time reconciliation)
//   - components/claim/ClaimLoginForm.tsx (existing-user claim-time reconciliation)
//   - components/transaction/ReconcileLaterBanner.tsx (deferred reconciliation modal)

export type MilestoneDefinitionLite = {
  id: string;
  code: string;
  name: string;
  side: "vendor" | "purchaser";
  orderIndex: number;
  blocksExchange: boolean;
};

export type ReconciliationRow = {
  ticked: boolean;
  eventDate: string | null;
  // Tracks which source milestone CODE auto-filled this row. Cleared when the agent
  // manually edits the row (they've taken ownership; the link is broken).
  autoFilledFrom?: string;
};
export type ReconciliationState = Record<string, ReconciliationRow>;

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

// Mirrors initializeMilestoneCompletions in lib/services/milestones.ts.
// Auto-NR codes are hidden from the picker because they're not relevant for this tenure/purchase combo.
export function autoNrCodesFor(tenure: Tenure, purchaseType: PurchaseType): Set<string> {
  const codes = new Set<string>();
  if (tenure === "freehold") {
    codes.add("VM8");
    codes.add("VM9");
    codes.add("PM12");
  }
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    codes.add("PM5");
    codes.add("PM6");
    codes.add("PM11");
  }
  return codes;
}

// Exchange / completion milestones — hidden from the reconciliation picker because
// chains exist pre-exchange. A claimed file by definition shouldn't have reached
// exchange or completion yet (the originator wouldn't be inviting agents otherwise).
const EXCHANGE_COMPLETION_CODES = new Set(["VM19", "VM20", "PM26", "PM27"]);

// Exchange-readiness gates — VM18 (vendor side) and PM25 (purchaser side). Each has
// no direct predecessor in DIRECT_PREREQUISITES, but logically requires ALL
// blocksExchange milestones on its own side to be done first. Mirrors the
// EXCHANGE_GATE_CODES set used by lib/services/milestones.ts.
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

// Bilateral cross-side milestone pairs. Ticking one auto-fills the counterpart with
// the same eventDate. Both directions defined so cascade works regardless of which
// side the agent ticks first. See plan for rationale per pair. VM19/PM26 and
// VM20/PM27 deliberately omitted — those rows are hidden by EXCHANGE_COMPLETION_CODES.
const CROSS_SIDE_PAIRS: Record<string, string> = {
  VM7: "PM7",   PM7: "VM7",     // Draft contract pack: vendor issued ↔ buyer received
  VM9: "PM12",  PM12: "VM9",    // Management pack: vendor received ↔ buyer received
  VM10: "PM14", PM14: "VM10",   // Initial enquiries: vendor received ↔ buyer raised
  VM12: "PM15", PM15: "VM12",   // Initial responses: vendor issued ↔ buyer received
  VM13: "PM17", PM17: "VM13",   // Additional enquiries: vendor received ↔ buyer raised
  VM15: "PM18", PM18: "VM15",   // Additional responses: vendor issued ↔ buyer received
};

const DEFAULT_ROW: ReconciliationRow = { ticked: false, eventDate: null };

export function ReconcileMilestonePicker({
  milestoneDefinitions,
  tenure,
  purchaseType,
  state,
  onChange,
  side,
}: {
  milestoneDefinitions: MilestoneDefinitionLite[];
  tenure: Tenure;
  purchaseType: PurchaseType;
  state: ReconciliationState;
  onChange: (next: ReconciliationState) => void;
  // When provided, renders only that side. When omitted, renders both (legacy
  // single-screen mode — kept for backward compat). The wizard in the claim
  // forms uses side="vendor" then side="purchaser" across two steps.
  side?: "vendor" | "purchaser";
}) {
  const autoNr = autoNrCodesFor(tenure, purchaseType);
  const filtered = milestoneDefinitions
    .filter((m) => !autoNr.has(m.code) && !EXCHANGE_COMPLETION_CODES.has(m.code))
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "vendor" ? -1 : 1;
      return a.orderIndex - b.orderIndex;
    });

  const vendor = filtered.filter((m) => m.side === "vendor");
  const purchaser = filtered.filter((m) => m.side === "purchaser");

  // Code ↔ id lookups for cross-side cascade
  const idByCode = useMemo(() => new Map(milestoneDefinitions.map((m) => [m.code, m.id])), [milestoneDefinitions]);
  const codeById = useMemo(() => new Map(milestoneDefinitions.map((m) => [m.id, m.code])), [milestoneDefinitions]);

  // Set of currently-ticked milestone codes (both sides) — derived from state.
  // Used by the prerequisite-lock check below.
  const tickedCodes = useMemo(() => {
    const s = new Set<string>();
    for (const [id, row] of Object.entries(state)) {
      if (row.ticked) {
        const code = codeById.get(id);
        if (code) s.add(code);
      }
    }
    return s;
  }, [state, codeById]);

  // A milestone is unlocked when every direct prerequisite is either ticked
  // OR auto-NR for this tenure/purchaseType combo. Reuses the same map the
  // normal completeMilestone flow uses so reconciliation can't produce a
  // state the standard flow would reject.
  //
  // Special case: VM18 / PM25 are exchange-readiness gates. They have no
  // direct predecessor in the prerequisite map, but they should only unlock
  // when every blocksExchange milestone on their own side is ticked or NR.
  // Without this, agents could tick "ready to exchange" without confirming
  // any of the upstream work that the gate logically depends on.
  function isUnlocked(code: string): boolean {
    if (EXCHANGE_GATE_CODES.has(code)) {
      const def = milestoneDefinitions.find((m) => m.code === code);
      if (!def) return true;
      const sameSideBlockers = milestoneDefinitions.filter(
        (m) =>
          m.side === def.side &&
          m.blocksExchange &&
          m.code !== code &&
          !EXCHANGE_COMPLETION_CODES.has(m.code),
      );
      return sameSideBlockers.every(
        (blocker) => tickedCodes.has(blocker.code) || autoNr.has(blocker.code),
      );
    }
    const prereqs = DIRECT_PREREQUISITES[code] ?? [];
    return prereqs.every((p) => tickedCodes.has(p) || autoNr.has(p));
  }

  // Build a set of currently-unlocked milestone IDs (filtered set only).
  // Used both to gate input and to drive the unlock-pulse animation.
  const unlockedSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of filtered) {
      if (isUnlocked(m.code)) s.add(m.id);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, tickedCodes]);

  // Track which rows newly became unlocked since the last render — those get a
  // brief background-pulse animation to signal the unlock to the agent.
  const prevUnlockedRef = useRef<Set<string>>(new Set());
  const [justUnlocked, setJustUnlocked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevUnlockedRef.current;
    const newly = new Set<string>();
    for (const id of unlockedSet) {
      if (!prev.has(id)) newly.add(id);
    }
    prevUnlockedRef.current = new Set(unlockedSet);
    if (newly.size > 0) {
      setJustUnlocked(newly);
      const timer = setTimeout(() => setJustUnlocked(new Set()), 700);
      return () => clearTimeout(timer);
    }
  }, [unlockedSet]);

  // Scroll the picker into view when it mounts (i.e. agent picked "Already in
  // progress") and when wizard step changes (vendor → purchaser). Without this
  // the agent is left halfway down the page with the top milestones below the
  // fold.
  //
  // Delay matters: the upper-form collapse animation is 320ms. If we scroll
  // during the collapse, the layout shifts mid-scroll and the smooth scroll
  // overshoots — agent lands at the bottom of the picker instead of the top.
  // Wait 400ms (320ms animation + 80ms buffer) so layout is fully settled,
  // then smooth-scroll to the picker's top.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(t);
  }, [side]);

  // Centralised row-change handler. Applies the user's patch to the source row,
  // clears autoFilledFrom on the source (user has touched it), then runs cascade
  // rules against any cross-side counterpart.
  function handleRowChange(id: string, patch: Partial<ReconciliationRow>) {
    const sourceCode = codeById.get(id);
    const existingSource = state[id] ?? DEFAULT_ROW;
    const updatedSource: ReconciliationRow = {
      ...existingSource,
      ...patch,
      // User editing this row → they've taken ownership; clear any auto-link
      autoFilledFrom: undefined,
    };

    const next: ReconciliationState = { ...state, [id]: updatedSource };

    if (!sourceCode) {
      onChange(next);
      return;
    }

    const counterpartCode = CROSS_SIDE_PAIRS[sourceCode];
    const counterpartId = counterpartCode ? idByCode.get(counterpartCode) : undefined;
    if (!counterpartId) {
      onChange(next);
      return;
    }

    const existingCounterpart = state[counterpartId] ?? DEFAULT_ROW;
    const counterpartIsAutoFromThisSource = existingCounterpart.autoFilledFrom === sourceCode;

    // Tick of source → set counterpart with same date IF counterpart is untouched
    // OR was previously auto-set from this same source. ALSO: counterpart must be
    // unlocked given the new ticked set (so we don't auto-tick a locked row).
    if (patch.ticked === true) {
      // Compute the would-be-unlocked state for the counterpart, factoring in
      // that the source row just became ticked (which might be the prereq that
      // unlocks the counterpart, e.g. VM9 → PM12).
      const tickedAfter = new Set(tickedCodes);
      tickedAfter.add(sourceCode);
      const counterpartPrereqs = DIRECT_PREREQUISITES[counterpartCode!] ?? [];
      const counterpartWouldBeUnlocked = counterpartPrereqs.every(
        (p) => tickedAfter.has(p) || autoNr.has(p),
      );

      if (
        counterpartWouldBeUnlocked &&
        (!existingCounterpart.ticked || counterpartIsAutoFromThisSource)
      ) {
        next[counterpartId] = {
          ticked: true,
          eventDate: updatedSource.eventDate,
          autoFilledFrom: sourceCode,
        };
      }
      // If counterpart is locked: skip cascade silently. Agent will reach the
      // counterpart in step 2 once its prereqs are ticked and can tick it manually.
    }
    // Untick of source → untick counterpart IF it was auto-set from this source.
    // If counterpart was manually ticked (no autoFilledFrom), leave it.
    else if (patch.ticked === false) {
      if (counterpartIsAutoFromThisSource) {
        next[counterpartId] = { ticked: false, eventDate: null };
      }
    }

    // Date change of source → propagate to counterpart IF it's still auto-linked.
    if ("eventDate" in patch && counterpartIsAutoFromThisSource && next[counterpartId]?.ticked) {
      next[counterpartId] = {
        ticked: true,
        eventDate: patch.eventDate ?? null,
        autoFilledFrom: sourceCode,
      };
    }

    onChange(next);
  }

  return (
    <div ref={containerRef} className="claim-reconcile-list">
      {(side === undefined || side === "vendor") && (
        <Section
          title="Vendor milestones"
          side="vendor"
          milestones={vendor}
          state={state}
          onRowChange={handleRowChange}
          unlockedSet={unlockedSet}
          justUnlocked={justUnlocked}
        />
      )}
      {(side === undefined || side === "purchaser") && (
        <Section
          title="Purchaser milestones"
          side="purchaser"
          milestones={purchaser}
          state={state}
          onRowChange={handleRowChange}
          unlockedSet={unlockedSet}
          justUnlocked={justUnlocked}
        />
      )}
    </div>
  );
}

function Section({
  title,
  side,
  milestones,
  state,
  onRowChange,
  unlockedSet,
  justUnlocked,
}: {
  title: string;
  side: Role;
  milestones: MilestoneDefinitionLite[];
  state: ReconciliationState;
  onRowChange: (id: string, patch: Partial<ReconciliationRow>) => void;
  unlockedSet: Set<string>;
  justUnlocked: Set<string>;
}) {
  if (milestones.length === 0) return null;

  return (
    <div className="claim-reconcile-section">
      <p className="claim-reconcile-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RoleIcon role={side} size={13} />
        {title}
      </p>
      <ul className="claim-reconcile-rows">
        {milestones.map((m) => {
          const row = state[m.id] ?? DEFAULT_ROW;
          const isAutoSet = !!row.autoFilledFrom;
          const isUnlocked = unlockedSet.has(m.id);
          const isJustUnlocked = justUnlocked.has(m.id);
          const classes = [
            "claim-reconcile-row",
            row.ticked ? "on" : "",
            !isUnlocked ? "locked" : "",
            isJustUnlocked ? "just-unlocked" : "",
          ].filter(Boolean).join(" ");
          return (
            <li key={m.id} className={classes}>
              <label className="claim-reconcile-row-main">
                <input
                  type="checkbox"
                  checked={row.ticked}
                  disabled={!isUnlocked}
                  onChange={(e) => onRowChange(m.id, { ticked: e.target.checked })}
                />
                <span className="claim-reconcile-row-name">
                  {m.name}
                  {isAutoSet && (
                    <span className="claim-reconcile-row-autoset"> (auto-set — change to override)</span>
                  )}
                  {!isUnlocked && (
                    <span className="claim-reconcile-row-locked"> (tick previous milestones first)</span>
                  )}
                </span>
              </label>
              {row.ticked && isUnlocked && (
                <input
                  type="date"
                  className="claim-reconcile-date"
                  value={row.eventDate ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => onRowChange(m.id, { eventDate: e.target.value || null })}
                  aria-label={`When did this happen? (${m.name})`}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

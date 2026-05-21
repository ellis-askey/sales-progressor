"use client";

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

// Bilateral cross-side milestone pairs. Ticking one auto-fills the counterpart with
// the same eventDate. Both directions defined so cascade works regardless of which
// side the agent ticks first. See plan for rationale per pair.
const CROSS_SIDE_PAIRS: Record<string, string> = {
  VM7: "PM7",   PM7: "VM7",     // Draft contract pack: vendor issued ↔ buyer received
  VM9: "PM12",  PM12: "VM9",    // Management pack: vendor received ↔ buyer received
  VM10: "PM14", PM14: "VM10",   // Initial enquiries: vendor received ↔ buyer raised
  VM12: "PM15", PM15: "VM12",   // Initial responses: vendor issued ↔ buyer received
  VM13: "PM17", PM17: "VM13",   // Additional enquiries: vendor received ↔ buyer raised
  VM15: "PM18", PM18: "VM15",   // Additional responses: vendor issued ↔ buyer received
  VM19: "PM26", PM26: "VM19",   // Exchange confirmed (bilateral pair)
  VM20: "PM27", PM27: "VM20",   // Completion confirmed (bilateral pair)
};

const DEFAULT_ROW: ReconciliationRow = { ticked: false, eventDate: null };

export function ReconcileMilestonePicker({
  milestoneDefinitions,
  tenure,
  purchaseType,
  state,
  onChange,
}: {
  milestoneDefinitions: MilestoneDefinitionLite[];
  tenure: Tenure;
  purchaseType: PurchaseType;
  state: ReconciliationState;
  onChange: (next: ReconciliationState) => void;
}) {
  const autoNr = autoNrCodesFor(tenure, purchaseType);
  const filtered = milestoneDefinitions
    .filter((m) => !autoNr.has(m.code))
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "vendor" ? -1 : 1;
      return a.orderIndex - b.orderIndex;
    });

  const vendor = filtered.filter((m) => m.side === "vendor");
  const purchaser = filtered.filter((m) => m.side === "purchaser");

  // Code ↔ id lookups for cross-side cascade
  const idByCode = new Map(milestoneDefinitions.map((m) => [m.code, m.id]));
  const codeById = new Map(milestoneDefinitions.map((m) => [m.id, m.code]));

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
    // OR was previously auto-set from this same source.
    if (patch.ticked === true) {
      if (!existingCounterpart.ticked || counterpartIsAutoFromThisSource) {
        next[counterpartId] = {
          ticked: true,
          eventDate: updatedSource.eventDate,
          autoFilledFrom: sourceCode,
        };
      }
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
    <div className="claim-reconcile-list">
      <Section title="Vendor milestones" milestones={vendor} state={state} onRowChange={handleRowChange} />
      <Section title="Purchaser milestones" milestones={purchaser} state={state} onRowChange={handleRowChange} />
    </div>
  );
}

function Section({
  title,
  milestones,
  state,
  onRowChange,
}: {
  title: string;
  milestones: MilestoneDefinitionLite[];
  state: ReconciliationState;
  onRowChange: (id: string, patch: Partial<ReconciliationRow>) => void;
}) {
  if (milestones.length === 0) return null;

  return (
    <div className="claim-reconcile-section">
      <p className="claim-reconcile-section-title">{title}</p>
      <ul className="claim-reconcile-rows">
        {milestones.map((m) => {
          const row = state[m.id] ?? DEFAULT_ROW;
          const isAutoSet = !!row.autoFilledFrom;
          return (
            <li key={m.id} className={`claim-reconcile-row${row.ticked ? " on" : ""}`}>
              <label className="claim-reconcile-row-main">
                <input
                  type="checkbox"
                  checked={row.ticked}
                  onChange={(e) => onRowChange(m.id, { ticked: e.target.checked })}
                />
                <span className="claim-reconcile-row-name">
                  {m.name}
                  {isAutoSet && (
                    <span className="claim-reconcile-row-autoset"> (auto-set — change to override)</span>
                  )}
                </span>
              </label>
              {row.ticked && (
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

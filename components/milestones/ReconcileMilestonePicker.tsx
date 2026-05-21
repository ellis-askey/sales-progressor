"use client";

// Reusable milestone reconciliation picker.
// Renders vendor + purchaser sections with checkbox + optional date input per row.
// Filters out auto-NR codes based on the file's tenure / purchaseType so the agent
// only sees milestones that are actually relevant.
//
// Used by:
//   - components/claim/ClaimConfirmForm.tsx (initial claim-time reconciliation)
//   - components/transaction/ReconcileLaterBanner.tsx (deferred reconciliation modal)

export type MilestoneDefinitionLite = {
  id: string;
  code: string;
  name: string;
  side: "vendor" | "purchaser";
  orderIndex: number;
};

export type ReconciliationRow = { ticked: boolean; eventDate: string | null };
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

  return (
    <div className="claim-reconcile-list">
      <Section title="Vendor milestones" milestones={vendor} state={state} onChange={onChange} />
      <Section title="Purchaser milestones" milestones={purchaser} state={state} onChange={onChange} />
    </div>
  );
}

function Section({
  title,
  milestones,
  state,
  onChange,
}: {
  title: string;
  milestones: MilestoneDefinitionLite[];
  state: ReconciliationState;
  onChange: (next: ReconciliationState) => void;
}) {
  if (milestones.length === 0) return null;

  function setRow(id: string, patch: Partial<ReconciliationRow>) {
    const existing = state[id] ?? { ticked: false, eventDate: null };
    onChange({ ...state, [id]: { ...existing, ...patch } });
  }

  return (
    <div className="claim-reconcile-section">
      <p className="claim-reconcile-section-title">{title}</p>
      <ul className="claim-reconcile-rows">
        {milestones.map((m) => {
          const row = state[m.id] ?? { ticked: false, eventDate: null };
          return (
            <li key={m.id} className={`claim-reconcile-row${row.ticked ? " on" : ""}`}>
              <label className="claim-reconcile-row-main">
                <input
                  type="checkbox"
                  checked={row.ticked}
                  onChange={(e) => setRow(m.id, { ticked: e.target.checked })}
                />
                <span className="claim-reconcile-row-name">{m.name}</span>
              </label>
              {row.ticked && (
                <input
                  type="date"
                  className="claim-reconcile-date"
                  value={row.eventDate ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRow(m.id, { eventDate: e.target.value || null })}
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

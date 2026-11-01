"use client";

// Historical-milestone grid for the Migrate Sale flow. Shows the COMPLETE
// applicable Vendor + Purchaser milestone lists — grouped and ordered exactly
// like the file's Steps tab (lib/milestone-sections) — and lets the team mark
// which were already done and when. It does NOT define its own catalogue: the
// rows come from the live MilestoneDefinition list and the not-required rules
// come from computeAutoNrCodes (the single source of truth shared with the
// engine). Steps that are auto-NR for this tenure/purchase-method are shown
// struck-through and can't be ticked.
//
// Efficient entry (no stepping through each milestone one by one):
//   • "Complete through here" on a row ticks that step + every earlier
//     applicable step on that side, all with one date — the common case when a
//     sale is already deep into conveyancing.
//   • A per-side date box applies one date to every ticked row at once.

import { useMemo } from "react";
import { VENDOR_SECTIONS, PURCHASER_SECTIONS } from "@/lib/milestone-sections";
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";
import type { PurchaseType, Tenure } from "@prisma/client";

const HAIRLINE = "var(--agent-hairline, rgba(0,0,0,0.10))";
const DATE_INPUT: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 5px",
  borderRadius: 7,
  border: `1px solid ${HAIRLINE}`,
  background: "var(--agent-input-bg, rgba(255,255,255,0.6))",
  color: "var(--agent-text-primary, #1a1a1a)",
};
const THROUGH_BTN: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 999,
  border: `1px solid ${HAIRLINE}`,
  background: "transparent",
  color: "var(--agent-text-secondary, #555)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

export type MilestoneDef = { id: string; code: string; name: string; side: "vendor" | "purchaser"; orderIndex: number };
export type Tick = { checked: boolean; date: string };
export type TickMap = Record<string, Tick>;

export function MilestoneHistoryGrid({
  defs,
  tenure,
  purchaseType,
  value,
  onChange,
  today,
}: {
  defs: MilestoneDef[];
  tenure: Tenure | "";
  purchaseType: PurchaseType | "";
  value: TickMap;
  onChange: (next: TickMap) => void;
  today: string;
}) {
  const autoNr = useMemo(
    () => computeAutoNrCodes(purchaseType || null, tenure || null),
    [purchaseType, tenure],
  );

  const vendorDefs = defs.filter((d) => d.side === "vendor").sort((a, b) => a.orderIndex - b.orderIndex);
  const purchaserDefs = defs.filter((d) => d.side === "purchaser").sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <Side
        label="Seller milestones"
        defs={vendorDefs}
        sections={VENDOR_SECTIONS}
        autoNr={autoNr}
        value={value}
        onChange={onChange}
        today={today}
      />
      <Side
        label="Buyer milestones"
        defs={purchaserDefs}
        sections={PURCHASER_SECTIONS}
        autoNr={autoNr}
        value={value}
        onChange={onChange}
        today={today}
      />
    </div>
  );
}

function Side({
  label,
  defs,
  sections,
  autoNr,
  value,
  onChange,
  today,
}: {
  label: string;
  defs: MilestoneDef[];
  sections: { label: string; codes: string[] }[];
  autoNr: Set<string>;
  value: TickMap;
  onChange: (next: TickMap) => void;
  today: string;
}) {
  const defByCode = new Map(defs.map((d) => [d.code, d]));
  // Applicable (not auto-NR) defs in progression order — the basis for
  // "complete through here" and the ticked count.
  const applicable = defs.filter((d) => !autoNr.has(d.code));
  const checkedCount = applicable.filter((d) => value[d.id]?.checked).length;

  const patch = (patchMap: TickMap) => onChange({ ...value, ...patchMap });

  function setRow(defId: string, p: Partial<Tick>) {
    const cur = value[defId] ?? { checked: false, date: today };
    patch({ [defId]: { ...cur, ...p } });
  }

  // Tick this step + every earlier applicable step on this side, all with `date`.
  function completeThrough(def: MilestoneDef, date: string) {
    const upto = applicable.filter((d) => d.orderIndex <= def.orderIndex);
    const next: TickMap = {};
    for (const d of upto) next[d.id] = { checked: true, date };
    patch(next);
  }

  // Apply one date to every already-ticked row on this side.
  function applyDateToTicked(date: string) {
    const next: TickMap = {};
    for (const d of applicable) {
      if (value[d.id]?.checked) next[d.id] = { checked: true, date };
    }
    patch(next);
  }

  return (
    <div className="agent-glass" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--agent-hairline)" }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--agent-hairline)" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{label}</p>
        <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>{checkedCount} marked done</span>
      </div>

      {/* Bulk date applier */}
      <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--agent-hairline)" }}>
        <label style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}>Apply one date to all marked:</label>
        <input
          type="date"
          max={today}
          onChange={(e) => { if (e.target.value) applyDateToTicked(e.target.value); }}
          style={{ ...DATE_INPUT, fontSize: 12, padding: "4px 6px" }}
          aria-label={`Apply one date to all marked ${label}`}
        />
      </div>

      <div style={{ maxHeight: 520, overflowY: "auto" }}>
        {sections.map((section) => {
          const sectionDefs = section.codes.map((c) => defByCode.get(c)).filter((d): d is MilestoneDef => !!d);
          if (sectionDefs.length === 0) return null;
          return (
            <div key={section.label}>
              <div style={{ padding: "6px 14px", background: "var(--agent-subtle-bg, rgba(0,0,0,0.03))" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-faint, var(--agent-text-secondary))" }}>{section.label}</p>
              </div>
              {sectionDefs.map((d) => {
                const isNr = autoNr.has(d.code);
                const row = value[d.id] ?? { checked: false, date: today };
                return (
                  <div
                    key={d.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                      borderTop: "1px solid var(--agent-hairline)",
                      opacity: isNr ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={row.checked}
                      disabled={isNr}
                      onChange={(e) => setRow(d.id, { checked: e.target.checked, date: row.date || today })}
                      aria-label={`${d.code} ${d.name}`}
                    />
                    <span style={{ fontSize: 11, width: 36, flexShrink: 0, color: "var(--agent-text-secondary)", textDecoration: isNr ? "line-through" : undefined }}>{d.code}</span>
                    <span
                      style={{ fontSize: 12, flex: 1, minWidth: 0, lineHeight: 1.3, color: "var(--agent-text-primary)", textDecoration: isNr ? "line-through" : undefined }}
                      title={isNr ? "Not required for this tenure / purchase type. Set automatically on import." : undefined}
                    >
                      {d.name}
                    </span>
                    {!isNr && !row.checked && (
                      <button
                        type="button"
                        onClick={() => completeThrough(d, row.date || today)}
                        style={THROUGH_BTN}
                        title="Mark this and every earlier applicable step done, with this date"
                      >
                        through here
                      </button>
                    )}
                    <input
                      type="date"
                      value={row.date}
                      max={today}
                      disabled={!row.checked || isNr}
                      onChange={(e) => setRow(d.id, { date: e.target.value })}
                      style={{ ...DATE_INPUT, flexShrink: 0, width: 130, opacity: !row.checked || isNr ? 0.4 : 1 }}
                      aria-label={`Date for ${d.code}`}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

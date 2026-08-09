"use client";

// Per-milestone chase cadence table for solicitor-owned steps. One row
// per SolicitorReminderRule. Ellis reviews + tweaks the cadences here
// without needing a code change or migration.
//
// Layout: grouped by side (Seller solicitor / Buyer solicitor), each
// row shows the step's plain-English label + a small anchor note when
// the chase clock starts from a non-direct-prereq milestone. Grace,
// repeat, and active toggle are inline-editable; save on blur (fire &
// forget with tiny "Saved" flash on the row).
//
// Anchor / useAnchorEventDate + maxChases stay read-only for now —
// changing them mid-flight has bigger implications and is rare enough
// that a code change per amendment is fine.

import { useState, useTransition } from "react";
import { updateSolicitorRule, type SolicitorRuleRow } from "@/app/actions/automation";

const STEP_LABELS: Record<string, string> = {
  VM5:  "Property information forms issued",
  VM7:  "Draft contract pack issued",
  VM8:  "Management pack requested (leasehold)",
  VM9:  "Management pack received",
  VM10: "Initial enquiries received",
  VM12: "Replies to initial enquiries issued",
  VM13: "Further enquiries received",
  VM15: "Replies to further enquiries issued",
  VM16: "Contract documents issued for signing",
  VM17: "Signed contract documents received back",
  VM18: "Ready to exchange",
  PM7:  "Draft contract pack received",
  PM8:  "Searches ordered",
  PM11: "Mortgage offer received",
  PM12: "Management pack received (buyer side)",
  PM13: "Search results received",
  PM14: "Initial enquiries raised",
  PM15: "Replies to initial enquiries received",
  PM16: "Replies to initial enquiries reviewed",
  PM17: "Further enquiries raised",
  PM18: "Replies to further enquiries received",
  PM19: "Replies to further enquiries reviewed",
  PM20: "All enquiries satisfied",
  PM22: "Contract documents issued for signing",
  PM23: "Signed contract documents received back",
  PM25: "Ready to exchange",
};

// Plain-English blurb for a step whose chase clock starts from a non-
// direct-prereq milestone. Matches the seed comments in the migration.
const ANCHOR_NOTES: Record<string, string> = {
  VM16: "Chases after replies to further enquiries are out — not straight after the draft pack.",
  PM7:  "Chases after the seller's solicitor has confirmed the pack was issued.",
  PM11: "Chases 5 wd after the valuation attends (falls back to booking date for desktop valuations).",
  PM15: "Chases after the seller's solicitor has confirmed replies were sent.",
  PM17: "Chases after the search results come back — that's what usually prompts them.",
  PM18: "Chases after the seller's solicitor has confirmed further replies were sent.",
};

function sideOf(code: string): "vendor" | "purchaser" {
  return code.startsWith("VM") ? "vendor" : "purchaser";
}

// Vendor first, then purchaser; within each side, numeric-then-alpha order
// (VM5 before VM10 before VM17). Matches how they appear on the file.
function sortRows(rows: SolicitorRuleRow[]): SolicitorRuleRow[] {
  return [...rows].sort((a, b) => {
    const sideA = sideOf(a.milestoneCode);
    const sideB = sideOf(b.milestoneCode);
    if (sideA !== sideB) return sideA === "vendor" ? -1 : 1;
    const numA = parseInt(a.milestoneCode.slice(2), 10);
    const numB = parseInt(b.milestoneCode.slice(2), 10);
    return numA - numB;
  });
}

export function SolicitorPerCodeTable({ initial }: { initial: SolicitorRuleRow[] }) {
  const [rows, setRows] = useState<SolicitorRuleRow[]>(() => sortRows(initial));
  const sortedRows = rows;
  const vendorRows = sortedRows.filter((r) => sideOf(r.milestoneCode) === "vendor");
  const purchaserRows = sortedRows.filter((r) => sideOf(r.milestoneCode) === "purchaser");

  function updateLocal(code: string, patch: Partial<SolicitorRuleRow>) {
    setRows((prev) => prev.map((r) => (r.milestoneCode === code ? { ...r, ...patch } : r)));
  }

  return (
    <div className="mt-6 rounded-xl border border-black/10 p-5" style={{ background: "var(--agent-surface-elevated)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--agent-text-primary)" }}>
        Per-step timings
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--agent-text-muted)" }}>
        First chase = grace working days after the step's chase clock starts.
        Second chase = repeat working days after the first. Cap of 2, then escalates to the assigned agent.
      </p>

      <SideBlock title="Seller's solicitor" rows={vendorRows} onLocalUpdate={updateLocal} />
      <SideBlock title="Buyer's solicitor" rows={purchaserRows} onLocalUpdate={updateLocal} />
    </div>
  );
}

function SideBlock({
  title, rows, onLocalUpdate,
}: {
  title: string;
  rows: SolicitorRuleRow[];
  onLocalUpdate: (code: string, patch: Partial<SolicitorRuleRow>) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--agent-text-muted)" }}>
        {title}
      </p>
      <div className="rounded-md border" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div
          className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "1fr 60px 60px 68px", color: "var(--agent-text-muted)", background: "rgba(15,23,42,0.02)" }}
        >
          <span>Step</span>
          <span className="text-right">Grace</span>
          <span className="text-right">Repeat</span>
          <span className="text-right">Active</span>
        </div>
        {rows.map((r) => (
          <RowEditor key={r.milestoneCode} row={r} onLocalUpdate={onLocalUpdate} />
        ))}
      </div>
    </div>
  );
}

function RowEditor({
  row, onLocalUpdate,
}: {
  row: SolicitorRuleRow;
  onLocalUpdate: (code: string, patch: Partial<SolicitorRuleRow>) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const label = STEP_LABELS[row.milestoneCode] ?? row.milestoneCode;
  const anchorNote = ANCHOR_NOTES[row.milestoneCode];

  function save(patch: Partial<SolicitorRuleRow>) {
    const next = { ...row, ...patch };
    onLocalUpdate(row.milestoneCode, patch);
    setError(null);
    start(async () => {
      const r = await updateSolicitorRule({
        milestoneCode: row.milestoneCode,
        graceWorkingDays: next.graceWorkingDays,
        repeatWorkingDays: next.repeatWorkingDays,
        maxChases: next.maxChases,
        active: next.active,
      });
      if (r.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1200);
      } else {
        setError(r.error);
        // Roll back local so the value stays consistent with the DB.
        onLocalUpdate(row.milestoneCode, {
          [Object.keys(patch)[0]]: (row as unknown as Record<string, unknown>)[Object.keys(patch)[0]],
        } as Partial<SolicitorRuleRow>);
      }
    });
  }

  return (
    <div
      className="grid items-start px-3 py-2 border-t"
      style={{
        gridTemplateColumns: "1fr 60px 60px 68px",
        borderColor: "rgba(15,23,42,0.06)",
        opacity: row.active ? 1 : 0.55,
      }}
    >
      <div className="min-w-0 pr-2">
        <p className="text-[13px] font-medium" style={{ color: "var(--agent-text-primary)" }}>
          {label}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--agent-text-muted)" }}>
          <span className="font-mono">{row.milestoneCode}</span>
          {anchorNote && <> · {anchorNote}</>}
        </p>
        {saved && <p className="text-[10px] mt-0.5" style={{ color: "#16a34a" }}>Saved</p>}
        {error && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>{error}</p>}
      </div>
      <NumberCell
        value={row.graceWorkingDays}
        disabled={pending || !row.active}
        onCommit={(v) => save({ graceWorkingDays: v })}
      />
      <NumberCell
        value={row.repeatWorkingDays}
        disabled={pending || !row.active}
        onCommit={(v) => save({ repeatWorkingDays: v })}
      />
      <div className="flex justify-end items-center">
        <button
          type="button"
          role="switch"
          aria-checked={row.active}
          onClick={() => save({ active: !row.active })}
          disabled={pending}
          className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors"
          style={{
            height: 20,
            width: 36,
            background: row.active ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
          }}
        >
          <span
            aria-hidden
            className="absolute rounded-full bg-white shadow"
            style={{
              width: 16,
              height: 16,
              top: 2,
              transition: "left 120ms ease",
              left: row.active ? 18 : 2,
            }}
          />
        </button>
      </div>
    </div>
  );
}

function NumberCell({
  value, disabled, onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={99}
      value={local}
      disabled={disabled}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseInt(local, 10);
        if (Number.isInteger(n) && n >= 1 && n !== value) onCommit(n);
        else setLocal(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full text-right text-[12px] tabular-nums px-2 py-1 rounded border"
      style={{
        borderColor: "rgba(15,23,42,0.12)",
        background: "#fff",
        color: "var(--agent-text-primary)",
      }}
    />
  );
}

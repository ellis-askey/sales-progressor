"use client";

import { useState } from "react";
import { Check, Lock, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { S } from "./ui";

// Mirrors the client portal's Progress page: own-side milestones grouped into
// collapsible sections, plus an "other side — view only" panel that shows label
// + tick ONLY, no dates (decision A2, matching the client's own other-side
// panel). Read-only here; confirming lives in Open Updates.

export type MRow = { code: string; label: string; labelOther: string; isComplete: boolean; isNotRequired: boolean; date: string | null };

const GROUPS: Record<"vendor" | "purchaser", { label: string; codes: string[] }[]> = {
  vendor: [
    { label: "Onboarding", codes: ["VM1", "VM2", "VM3", "VM4"] },
    { label: "Contract preparation", codes: ["VM5", "VM6", "VM7", "VM8", "VM9"] },
    { label: "Enquiries", codes: ["VM10", "VM21"] },
    { label: "Ready to exchange", codes: ["VM16", "VM17", "VM18"] },
    { label: "After exchange", codes: ["VM19", "VM20"] },
  ],
  purchaser: [
    { label: "Onboarding", codes: ["PM1", "PM2", "PM3", "PM4"] },
    { label: "Mortgage", codes: ["PM5", "PM6", "PM11"] },
    { label: "Survey", codes: ["PM9", "PM10"] },
    { label: "Searches & legal", codes: ["PM7", "PM8", "PM12", "PM13"] },
    { label: "Enquiries", codes: ["PM14", "PM20", "PM21"] },
    { label: "Ready to exchange", codes: ["PM22", "PM23", "PM24", "PM25"] },
    { label: "After exchange", codes: ["PM26", "PM27"] },
  ],
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function ProgressMirror({ side, ownRows, otherRows }: { side: "vendor" | "purchaser"; ownRows: MRow[]; otherRows: MRow[] }) {
  const otherSide = side === "vendor" ? "purchaser" : "vendor";
  const ownByCode = new Map(ownRows.map((r) => [r.code, r]));
  const otherByCode = new Map(otherRows.map((r) => [r.code, r]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Own side */}
      <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: S.radiusMd, boxShadow: S.shadowCard, padding: "6px 4px" }}>
        {GROUPS[side].map((g) => {
          const rows = g.codes.map((c) => ownByCode.get(c)).filter((r): r is MRow => !!r && !r.isNotRequired);
          if (!rows.length) return null;
          return <Group key={g.label} label={g.label} rows={rows} viewOnly={false} />;
        })}
      </div>

      {/* Other side — view only */}
      <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: S.radiusMd, boxShadow: S.shadowCard, padding: "16px 18px 6px", borderLeft: `3px solid ${S.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: S.muted }}>
            {otherSide === "purchaser" ? "The buyer's side" : "The seller's side"}
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: S.muted, background: "rgba(15,39,64,0.05)", borderRadius: 999, padding: "1px 8px" }}>View only</span>
        </div>
        {GROUPS[otherSide].map((g) => {
          const rows = g.codes.map((c) => otherByCode.get(c)).filter((r): r is MRow => !!r && !r.isNotRequired);
          if (!rows.length) return null;
          return <Group key={g.label} label={g.label} rows={rows} viewOnly />;
        })}
      </div>
    </div>
  );
}

function Group({ label, rows, viewOnly }: { label: string; rows: MRow[]; viewOnly: boolean }) {
  const doneCount = rows.filter((r) => r.isComplete).length;
  const allDone = doneCount === rows.length;
  const [open, setOpen] = useState(!allDone);

  return (
    <div style={{ borderTop: viewOnly ? `1px solid ${S.line}` : "none" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: S.ink }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? S.successRing : S.muted, background: allDone ? S.successBg : "rgba(15,39,64,0.05)", borderRadius: 999, padding: "2px 9px" }}>
          {allDone ? "Done" : `${doneCount}/${rows.length}`}
        </span>
        <CaretDown size={14} weight="bold" color={S.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 8px" }}>
          {rows.map((r) => (
            <Row key={r.code} row={r} viewOnly={viewOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ row, viewOnly }: { row: MRow; viewOnly: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "9px 0" }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          marginTop: 1,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: row.isComplete ? S.successRing : "transparent",
          border: row.isComplete ? "none" : `2px solid rgba(15,39,64,0.2)`,
          color: "#fff",
        }}
      >
        {row.isComplete ? <Check size={12} weight="bold" /> : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: row.isComplete ? S.muted : S.ink, lineHeight: 1.4, textDecoration: row.isComplete ? "line-through" : "none" }}>
          {viewOnly ? row.labelOther : row.label}
        </p>
        {!viewOnly && row.isComplete && row.date && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: S.muted }}>Confirmed {fmtDate(row.date)}</p>
        )}
      </div>
    </div>
  );
}

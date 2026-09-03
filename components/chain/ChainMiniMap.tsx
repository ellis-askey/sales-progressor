"use client";

// Compact chain visual for a workspace card. Renders the main spine bottom→top,
// left→right, numbered by display level (bottom = 1, matching the drawer), with
// onward branches lifting off the node they fork above. Our sale is a filled
// coral node labelled "You". Long chains window around our node + the forks with
// "···" for collapsed spans. Generated from real chain data — see the approved
// prototype. Used only by the chains workspace.

import { Fragment } from "react";
import type { ChainMiniNode, ChainMiniBranch } from "@/lib/services/chains";
import type { ChainLinkStatusKind } from "@/lib/chain/status";

const COL = 46;   // horizontal step between columns
const ROW = 40;   // vertical step between the spine and a branch row
const R = 13;     // node radius
const TOP_PAD = 6;
const LABEL_PAD = 15; // room for the "You" tag under the spine
const MAX_COLS = 9;   // window longer chains down to this many columns

function nodeStyle(kind: ChainLinkStatusKind, isOurs: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 2 * R,
    height: 2 * R,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 680,
    fontVariantNumeric: "tabular-nums",
    boxSizing: "border-box",
    background: "var(--agent-surface-elevated)",
  };
  if (isOurs) return { ...base, background: "var(--agent-coral-deep)", color: "#fff", border: "1.5px solid var(--agent-coral-deep)" };
  switch (kind) {
    case "claimed_own":
    case "claimed_other":
    case "your_transaction":
      return { ...base, border: "1.5px solid var(--agent-border-strong)", color: "var(--agent-text-secondary)" };
    case "unclaimed_unsent":
      return { ...base, border: "1.5px solid var(--agent-warning)", color: "var(--agent-warning)" };
    case "unclaimed_no_email":
      return { ...base, background: "transparent", border: "1.5px dashed var(--agent-border-strong)", color: "var(--agent-text-muted)" };
    default: // invited, declined, bounced
      return { ...base, border: "1.5px solid var(--agent-text-muted)", color: "var(--agent-text-muted)" };
  }
}

// Which levels stay visible when a chain is too long: always keep the two ends,
// our node + its neighbours, and every fork span, filling out to MAX_COLS.
function windowLevels(maxLevel: number, youLevel: number | null, branches: ChainMiniBranch[]): number[] {
  if (maxLevel <= MAX_COLS) return Array.from({ length: maxLevel }, (_, i) => i + 1);
  const keep = new Set<number>([1, maxLevel]);
  if (youLevel != null) keep.add(youLevel);
  for (const b of branches) {
    keep.add(b.forkLevel);
    for (const nd of b.nodes) keep.add(nd.level);
  }
  const centre = youLevel ?? Math.ceil(maxLevel / 2);
  let r = 1;
  while (keep.size < MAX_COLS && r < maxLevel) {
    if (centre - r >= 1) keep.add(centre - r);
    if (keep.size < MAX_COLS && centre + r <= maxLevel) keep.add(centre + r);
    r++;
  }
  return [...keep].sort((a, b) => a - b);
}

export function ChainMiniMap({ spine, branches }: { spine: ChainMiniNode[]; branches: ChainMiniBranch[] }) {
  const spineSorted = [...spine].sort((a, b) => a.level - b.level);
  if (spineSorted.length === 0) return null;

  const youLevel = spineSorted.find((n) => n.isOurs)?.level ?? null;
  const branchMax = branches.reduce((m, b) => Math.max(m, ...b.nodes.map((n) => n.level)), 0);
  const maxLevel = Math.max(spineSorted[spineSorted.length - 1].level, branchMax);

  const visible = windowLevels(maxLevel, youLevel, branches);
  const visibleSet = new Set(visible);

  // Build the column sequence: each visible level is a slot; a run of collapsed
  // levels becomes a single "gap" slot.
  type Slot = { level: number | null };
  const slots: Slot[] = [];
  const slotOfLevel = new Map<number, number>();
  visible.forEach((lv, i) => {
    if (i > 0 && lv - visible[i - 1] > 1) slots.push({ level: null }); // gap
    slotOfLevel.set(lv, slots.length);
    slots.push({ level: lv });
  });

  const totalRows = 1 + branches.length; // spine (row 0) + one row per branch
  const xForSlot = (s: number) => s * COL + R + 2;
  const yForRow = (row: number) => TOP_PAD + (totalRows - 1 - row) * ROW + R; // row 0 = bottom (spine)
  const width = Math.max(slots.length * COL, COL);
  const mapH = yForRow(0) + R + LABEL_PAD;

  const spineY = yForRow(0);
  const spineByLevel = new Map(spineSorted.map((n) => [n.level, n]));

  // ── connectors ──
  const lines: React.ReactNode[] = [];
  // spine horizontals between adjacent visible spine nodes
  for (let i = 0; i < visible.length - 1; i++) {
    const a = visible[i], b = visible[i + 1];
    if (b - a === 1 && spineByLevel.has(a) && spineByLevel.has(b)) {
      lines.push(
        <line key={`s${a}`} x1={xForSlot(slotOfLevel.get(a)!) + R} y1={spineY} x2={xForSlot(slotOfLevel.get(b)!) - R} y2={spineY} />,
      );
    }
  }
  branches.forEach((b, bi) => {
    const row = bi + 1;
    const rowY = yForRow(row);
    const visNodes = b.nodes.filter((n) => visibleSet.has(n.level)).sort((a, c) => a.level - c.level);
    // fork elbow: spine fork node → the branch's bottom (lowest) visible node
    if (visibleSet.has(b.forkLevel) && visNodes.length) {
      const first = visNodes[0];
      const x1 = xForSlot(slotOfLevel.get(b.forkLevel)!), y1 = spineY - R;
      const x2 = xForSlot(slotOfLevel.get(first.level)!), y2 = rowY + R;
      const my = (y1 + y2) / 2;
      lines.push(<path key={`f${bi}`} d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`} fill="none" />);
    }
    // horizontals within the branch
    for (let i = 0; i < visNodes.length - 1; i++) {
      const a = visNodes[i], c = visNodes[i + 1];
      if (c.level - a.level === 1) {
        lines.push(
          <line key={`b${bi}-${a.level}`} x1={xForSlot(slotOfLevel.get(a.level)!) + R} y1={rowY} x2={xForSlot(slotOfLevel.get(c.level)!) - R} y2={rowY} />,
        );
      }
    }
  });

  // ── nodes ──
  const dots: React.ReactNode[] = [];
  slots.forEach((slot, si) => {
    if (slot.level == null) {
      dots.push(
        <span key={`gap${si}`} aria-hidden style={{ position: "absolute", left: xForSlot(si), top: spineY, transform: "translate(-50%,-50%)", color: "var(--agent-text-muted)", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
          ···
        </span>,
      );
      return;
    }
    const node = spineByLevel.get(slot.level);
    if (!node) return;
    dots.push(
      <span key={`n${slot.level}`} style={{ ...nodeStyle(node.statusKind, node.isOurs), left: xForSlot(si) - R, top: spineY - R }}>
        {node.level}
      </span>,
    );
    if (node.isOurs) {
      dots.push(
        <span key="you" style={{ position: "absolute", left: xForSlot(si), top: spineY + R + 3, transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 700, color: "var(--agent-coral-deep)", whiteSpace: "nowrap" }}>
          You
        </span>,
      );
    }
  });
  branches.forEach((b, bi) => {
    const row = bi + 1;
    const rowY = yForRow(row);
    for (const node of b.nodes) {
      if (!visibleSet.has(node.level)) continue;
      const si = slotOfLevel.get(node.level)!;
      dots.push(
        <span key={`bn${bi}-${node.level}`} style={{ ...nodeStyle(node.statusKind, node.isOurs), left: xForSlot(si) - R, top: rowY - R }}>
          {node.level}
        </span>,
      );
    }
  });

  const label = `Chain of ${spineSorted.length} in the main line${branches.length ? `, with ${branches.length} onward split${branches.length === 1 ? "" : "s"}` : ""}${youLevel != null ? `, your sale at position ${youLevel}` : ""}`;

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", padding: "2px 0" }}>
      <div role="img" aria-label={label} style={{ position: "relative", width, height: mapH }}>
        <svg width={width} height={mapH} viewBox={`0 0 ${width} ${mapH}`} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden>
          <g stroke="var(--agent-border-strong)" strokeWidth={2} strokeLinecap="round">
            {lines}
          </g>
        </svg>
        {dots}
      </div>
    </div>
  );
}

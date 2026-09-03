"use client";

// Compact horizontal chain visual for a chains-workspace card: one node per link,
// left → right in chain order (the codebase convention: leftmost = bottom / below,
// rightmost = top / above). Our sale is a filled coral node labelled "You".
// Generated entirely from the real links array — never hard-coded — and it copes
// with any length: short chains render every node, long chains window around our
// node with "···" for the collapsed spans so the layout never blows out.

import { Fragment } from "react";
import type { ChainsWorkspaceLink } from "@/lib/services/chains";

const MAX_NODES = 9;

// Pick which node indices to show when a chain is too long to render in full.
// Always keeps the two ends and a window around our node, filling out to MAX_NODES
// from the centre outward. Returns a sorted, deduped index list.
function compactIndices(n: number, ourIdx: number): number[] {
  const keep = new Set<number>([0, n - 1]);
  const centre = ourIdx >= 0 ? ourIdx : Math.floor(n / 2);
  keep.add(centre);
  let radius = 1;
  while (keep.size < MAX_NODES && radius < n) {
    if (centre - radius >= 0) keep.add(centre - radius);
    if (keep.size < MAX_NODES && centre + radius < n) keep.add(centre + radius);
    radius++;
  }
  return [...keep].sort((a, b) => a - b);
}

type Item =
  | { kind: "node"; index: number; link: ChainsWorkspaceLink }
  | { kind: "gap"; count: number };

const CIRCLE = 22;
const CONNECTOR = 16;
// Vertical offset so connectors + ellipses line up with the circle centres while
// nodes reserve room for the "You" label underneath.
const CENTRE_OFFSET = CIRCLE / 2 - 1;

export function ChainMiniMap({ links }: { links: ChainsWorkspaceLink[] }) {
  const n = links.length;
  if (n === 0) return null;

  const ourIdx = links.findIndex((l) => l.isOurs);
  const shown = n <= MAX_NODES ? links.map((_, i) => i) : compactIndices(n, ourIdx);

  // Weave in "gap" markers wherever the shown indices skip one or more nodes.
  const items: Item[] = [];
  shown.forEach((idx, i) => {
    if (i > 0) {
      const prev = shown[i - 1];
      if (idx - prev > 1) items.push({ kind: "gap", count: idx - prev - 1 });
    }
    items.push({ kind: "node", index: idx, link: links[idx] });
  });

  return (
    <div
      role="img"
      aria-label={`Chain of ${n} ${n === 1 ? "property" : "properties"}${ourIdx >= 0 ? `, your sale is number ${ourIdx + 1}` : ""}`}
      style={{ display: "flex", alignItems: "flex-start", flexWrap: "nowrap", overflow: "hidden" }}
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden
              style={{
                width: CONNECTOR,
                height: 2,
                marginTop: CENTRE_OFFSET,
                background: "var(--agent-border-default)",
                flexShrink: 0,
              }}
            />
          )}
          {item.kind === "gap" ? (
            <span
              aria-hidden
              style={{
                marginTop: CENTRE_OFFSET - 8,
                color: "var(--agent-text-muted)",
                fontSize: 13,
                lineHeight: 1,
                letterSpacing: 1,
                flexShrink: 0,
              }}
              title={`${item.count} more`}
            >
              ···
            </span>
          ) : (
            <ChainNode index={item.index} link={item.link} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function ChainNode({ index, link }: { index: number; link: ChainsWorkspaceLink }) {
  const { isOurs, claimed, needsInvite } = link;

  const base: React.CSSProperties = {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10.5,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    boxSizing: "border-box",
  };

  const style: React.CSSProperties = isOurs
    ? { ...base, background: "var(--agent-coral-deep)", color: "#fff", border: "1px solid var(--agent-coral-deep)" }
    : needsInvite
      ? { ...base, background: "var(--agent-surface-elevated)", color: "var(--agent-warning)", border: "1px solid var(--agent-warning)" }
      : claimed
        ? { ...base, background: "var(--agent-surface-elevated)", color: "var(--agent-text-secondary)", border: "1px solid var(--agent-border-strong)" }
        : { ...base, background: "transparent", color: "var(--agent-text-muted)", border: "1px dashed var(--agent-border-strong)" };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
      <span style={style}>{index + 1}</span>
      <span
        style={{
          fontSize: 9.5,
          lineHeight: 1,
          fontWeight: isOurs ? 700 : 500,
          color: isOurs ? "var(--agent-coral-deep)" : "transparent",
          height: 10,
        }}
      >
        You
      </span>
    </span>
  );
}

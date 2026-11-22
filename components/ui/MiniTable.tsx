import type { CSSProperties, ReactNode } from "react";

// Canonical mini data-table — a compact, borderless key/value table (uppercase 10px column
// headers, 13px tabular rows, hairline row separators). Extracted 2026-11-22 from the hub's
// "Your clients" breakdown. One flex label column (grows, ellipsis) + any number of fixed-
// width right-aligned columns. Cell content is passed as nodes, so a cell can carry its own
// accent (a coral fee, a "Set fee" link) over the base styling.

export interface MiniTableColumn {
  key: string;
  header: string;
  /** The single growing label column (left-aligned, ellipsis, bold ink). */
  flex?: boolean;
  /** Fixed min-width (px) for the fixed right-aligned columns. */
  width?: number;
  align?: "left" | "right";
}

export type MiniTableRow = { key: string } & Record<string, ReactNode>;

export function MiniTable({
  columns,
  rows,
}: {
  columns: MiniTableColumn[];
  rows: MiniTableRow[];
}) {
  const base = (c: MiniTableColumn): CSSProperties => ({
    flex: c.flex ? 1 : undefined,
    minWidth: c.flex ? 0 : c.width,
    textAlign: c.align ?? (c.flex ? "left" : "right"),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6 }}>
        {columns.map((c) => (
          <span key={c.key} style={{ ...base(c), fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", fontWeight: 600 }}>
            {c.header}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
          {columns.map((c) => (
            <span
              key={c.key}
              style={{
                ...base(c),
                fontSize: 13,
                fontWeight: c.flex ? 600 : undefined,
                color: c.flex ? "var(--agent-text-primary)" : "var(--agent-text-secondary)",
                fontVariantNumeric: c.flex ? undefined : "tabular-nums",
                overflow: c.flex ? "hidden" : undefined,
                textOverflow: c.flex ? "ellipsis" : undefined,
                whiteSpace: c.flex ? "nowrap" : undefined,
                display: c.flex ? undefined : "inline-flex",
                justifyContent: c.flex ? undefined : "flex-end",
                alignItems: "center",
              }}
            >
              {row[c.key]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

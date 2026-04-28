"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type LeaderboardRow = {
  id: string;
  name: string;
  role: string;
  submitted: number;
  exchanged: number;
  conversion: number | null;
  pipelineValue: number;
  avgFee: number | null;
  lockedFees: number | null;
};

type SortKey = "submitted" | "exchanged" | "conversion" | "pipelineValue" | "avgFee" | "lockedFees";
type SortDir = "asc" | "desc";

const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: "submitted",    label: "Submitted" },
  { key: "exchanged",    label: "Exchanged" },
  { key: "conversion",   label: "Conversion" },
  { key: "pipelineValue", label: "Pipeline" },
  { key: "avgFee",       label: "Avg fee" },
  { key: "lockedFees",   label: "Locked in" },
];

const ROLE_LABEL: Record<string, string> = {
  director:         "Director",
  negotiator:       "Negotiator",
  sales_progressor: "Progressor",
};

function fmtGBP(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function numVal(row: LeaderboardRow, key: SortKey, dir: SortDir): number {
  const v = row[key as keyof LeaderboardRow] as number | null;
  if (v === null) return dir === "desc" ? -Infinity : Infinity;
  return v;
}

function sorted(rows: LeaderboardRow[], key: SortKey, dir: SortDir): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    const diff = numVal(a, key, dir) - numVal(b, key, dir);
    if (diff !== 0) return dir === "desc" ? -diff : diff;
    return a.name.localeCompare(b.name);
  });
}

function rowHref(userId: string, period: string): string {
  const p = new URLSearchParams({ user: userId });
  if (period !== "month") p.set("period", period);
  return `/agent/analytics?${p.toString()}`;
}

type Props = {
  rows: LeaderboardRow[];
  currentUserId: string;
  period: string;
};

export function LeaderboardTable({ rows, currentUserId, period }: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("exchanged");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows2 = sorted(rows, sortKey, sortDir);

  function fmtVal(row: LeaderboardRow): Record<SortKey, string> {
    return {
      submitted:     String(row.submitted),
      exchanged:     String(row.exchanged),
      conversion:    row.conversion !== null ? `${row.conversion}%` : "—",
      pipelineValue: row.pipelineValue > 0 ? fmtGBP(row.pipelineValue) : "—",
      avgFee:        row.avgFee     !== null ? fmtGBP(row.avgFee)      : "—",
      lockedFees:    row.lockedFees !== null ? fmtGBP(row.lockedFees)  : "—",
    };
  }

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: "9px 14px",
    fontSize: 11, fontWeight: 600,
    color: sortKey === key ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
    textAlign: "right", whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none",
  });

  return (
    <>
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.025)", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
              <th style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>
                Negotiator
              </th>
              {SORT_COLS.map(({ key, label }) => (
                <th key={key} style={thStyle(key)} onClick={() => handleSort(key)}>
                  {label}{sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows2.map((row, i) => {
              const vals = fmtVal(row);
              const isFirst = i === 0;
              return (
                <tr
                  key={row.id}
                  onClick={() => router.push(rowHref(row.id, period))}
                  style={{
                    cursor: "pointer",
                    borderTop: "0.5px solid var(--agent-border-subtle)",
                    borderLeft: isFirst ? "3px solid var(--agent-coral)" : "3px solid transparent",
                    background: isFirst ? "rgba(255,138,101,0.04)" : "transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isFirst ? "rgba(255,138,101,0.08)" : "rgba(0,0,0,0.025)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isFirst ? "rgba(255,138,101,0.04)" : "transparent"; }}
                >
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", whiteSpace: "nowrap" }}>
                    {row.name}
                    <span style={{ fontWeight: 400, color: "var(--agent-text-muted)", marginLeft: 4 }}>
                      · {ROLE_LABEL[row.role] ?? row.role}
                    </span>
                    {row.id === currentUserId && (
                      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 4 }}>(you)</span>
                    )}
                  </td>
                  {SORT_COLS.map(({ key }) => (
                    <td key={key} style={{ padding: "11px 14px", fontSize: 12, color: "var(--agent-text-secondary)", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {vals[key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden">
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>Sort by</span>
          <select
            value={sortKey}
            onChange={e => { setSortKey(e.target.value as SortKey); setSortDir("desc"); }}
            className="glass-input"
            style={{ fontSize: 12, padding: "4px 8px", flex: 1 }}
          >
            {SORT_COLS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            style={{ fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--agent-text-muted)", padding: "4px 2px", minHeight: 36 }}
            aria-label="Toggle sort direction"
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        {rows2.map((row, i) => {
          const vals = fmtVal(row);
          const isFirst = i === 0;
          return (
            <div
              key={row.id}
              onClick={() => router.push(rowHref(row.id, period))}
              style={{
                padding: "11px 14px",
                borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                cursor: "pointer",
                borderLeft: isFirst ? "3px solid var(--agent-coral)" : "3px solid transparent",
                background: isFirst ? "rgba(255,138,101,0.04)" : undefined,
              }}
            >
              <p style={{ margin: "0 0 7px", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {row.name}
                <span style={{ fontWeight: 400, color: "var(--agent-text-muted)", marginLeft: 4 }}>
                  · {ROLE_LABEL[row.role] ?? row.role}
                </span>
                {row.id === currentUserId && (
                  <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 4 }}>(you)</span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {SORT_COLS.map(({ key, label }) => (
                  <div key={key}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: vals[key] === "—" ? "rgba(15,23,42,0.18)" : "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{vals[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

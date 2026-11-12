"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A leaderboard column: the metric key into the row's `values`, its label, and
// how to render the number. One config powers the sales board, another the
// progression board — same table, same sorting, same look.
export type LbFormat = "int" | "gbp" | "pct" | "days";
export type LbColumn = { key: string; label: string; format: LbFormat };

export type LeaderboardRow = {
  id: string;
  name: string;
  role: string;
  values: Record<string, number | null>;
};

// ── Column sets ─────────────────────────────────────────────────────────────

// Sales: credits each file to the person who agreed the sale (agentUser).
export const SALES_COLUMNS: LbColumn[] = [
  { key: "submitted",     label: "Submitted",  format: "int" },
  { key: "exchanged",     label: "Exchanged",  format: "int" },
  { key: "conversion",    label: "Conversion", format: "pct" },
  { key: "pipelineValue", label: "Pipeline",   format: "gbp" },
  { key: "avgFee",        label: "Avg fee",    format: "gbp" },
  { key: "lockedFees",    label: "Locked in",  format: "gbp" },
];

// Progression: credits each file to the person progressing it (assignedUser).
// No fees — those belong to whoever agreed the sale, not the progressor.
export const PROGRESSION_COLUMNS: LbColumn[] = [
  { key: "progressing",   label: "Progressing", format: "int" },
  { key: "exchanged",     label: "Exchanged",   format: "int" },
  { key: "completed",     label: "Completed",   format: "int" },
  { key: "speedDays",     label: "Avg speed",   format: "days" },
  { key: "successRate",   label: "Success",     format: "pct" },
  { key: "pipelineValue", label: "Pipeline",    format: "gbp" },
];

type SortDir = "asc" | "desc";

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

function fmtCell(v: number | null, format: LbFormat): string {
  if (v === null) return "—";
  if (format === "int")  return String(v);
  if (format === "pct")  return `${v}%`;
  if (format === "days") return `${v}d`;
  // gbp — a zero pipeline / fee reads as "—", not "£0"
  return v === 0 ? "—" : fmtGBP(v);
}

function numVal(row: LeaderboardRow, key: string, dir: SortDir): number {
  const v = row.values[key];
  if (v === null || v === undefined) return dir === "desc" ? -Infinity : Infinity;
  return v;
}

function sorted(rows: LeaderboardRow[], key: string, dir: SortDir): LeaderboardRow[] {
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
  columns: LbColumn[];
  nameHeader: string;
  currentUserId: string;
  period: string;
  defaultSortKey?: string;
};

export function LeaderboardTable({ rows, columns, nameHeader, currentUserId, period, defaultSortKey }: Props) {
  const router = useRouter();
  const initialKey = defaultSortKey && columns.some(c => c.key === defaultSortKey)
    ? defaultSortKey
    : (columns.find(c => c.key === "exchanged")?.key ?? columns[0]?.key ?? "");
  const [sortKey, setSortKey] = useState<string>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Guard against a stale sortKey when the column set flips (sales ⟷ progression).
  const activeKey = columns.some(c => c.key === sortKey) ? sortKey : initialKey;

  function handleSort(key: string) {
    if (key === activeKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows2 = sorted(rows, activeKey, sortDir);

  const thStyle = (key: string): React.CSSProperties => ({
    padding: "9px 14px",
    fontSize: 11, fontWeight: 600,
    color: activeKey === key ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
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
                {nameHeader}
              </th>
              {columns.map(({ key, label }) => (
                <th key={key} style={thStyle(key)} onClick={() => handleSort(key)}>
                  {label}{activeKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows2.map((row, i) => {
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
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--agent-hover-tint)"; }}
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
                  {columns.map(({ key, format }) => (
                    <td key={key} style={{ padding: "11px 14px", fontSize: 12, color: "var(--agent-text-secondary)", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {fmtCell(row.values[key] ?? null, format)}
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
            value={activeKey}
            onChange={e => { setSortKey(e.target.value); setSortDir("desc"); }}
            className="glass-input"
            style={{ fontSize: 12, padding: "4px 8px", flex: 1 }}
          >
            {columns.map(({ key, label }) => (
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
                {columns.map(({ key, label, format }) => {
                  const cell = fmtCell(row.values[key] ?? null, format);
                  return (
                    <div key={key}>
                      <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: cell === "—" ? "rgba(15,23,42,0.18)" : "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{cell}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

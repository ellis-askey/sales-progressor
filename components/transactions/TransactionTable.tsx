"use client";

import { useState } from "react";
import { calculateRiskScore } from "@/lib/services/risk";
import { GlassCard } from "@/components/glass/GlassCard";
import { TransactionRowView, filesColumns, filesGridTemplate } from "@/components/transactions/TransactionRowView";
import type { TransactionRow, HealthRaw, FilesColumn, FilesTab } from "@/components/transactions/TransactionRowView";
import type { TransactionStatus } from "@prisma/client";

export type { TransactionRow, HealthRaw };

type SortKey = "exchange" | "property" | "status" | "risk" | "lastActive";
type SortDir = "asc" | "desc";

const STATUS_ORDER: TransactionStatus[] = ["active", "on_hold", "completed", "withdrawn", "draft"];

function riskScore(tx: TransactionRow): number {
  if (!tx.health) return 0;
  return calculateRiskScore({
    onTrack: tx.health.onTrack ?? "unknown",
    escalatedTaskCount: tx.health.escalatedTasks,
    overdueTaskCount: tx.health.pendingOverdueTasks,
    daysSinceLastActivity: tx.health.lastActivityAt
      ? Math.floor((Date.now() - new Date(tx.health.lastActivityAt).getTime()) / 86400000)
      : null,
    daysStuckOnMilestone: tx.health.daysStuckOnMilestone,
  }).score;
}

function applySortDir(n: number, dir: SortDir) { return dir === "asc" ? n : -n; }

function sortTransactions(rows: TransactionRow[], key: SortKey, dir: SortDir): TransactionRow[] {
  return [...rows].sort((a, b) => {
    switch (key) {
      case "exchange": {
        const da = a.expectedExchangeDate ? new Date(a.expectedExchangeDate).getTime() : null;
        const db = b.expectedExchangeDate ? new Date(b.expectedExchangeDate).getTime() : null;
        if (da === null && db === null) return a.propertyAddress.localeCompare(b.propertyAddress);
        if (da === null) return 1;
        if (db === null) return -1;
        return applySortDir(da - db, dir);
      }
      case "property":
        return applySortDir(a.propertyAddress.localeCompare(b.propertyAddress), dir);
      case "status": {
        const ia = STATUS_ORDER.indexOf(a.status);
        const ib = STATUS_ORDER.indexOf(b.status);
        return applySortDir(ia - ib, dir);
      }
      case "risk":
        return applySortDir(riskScore(b) - riskScore(a), dir);
      case "lastActive": {
        const la = a.health?.lastActivityAt ? new Date(a.health.lastActivityAt).getTime() : 0;
        const lb = b.health?.lastActivityAt ? new Date(b.health.lastActivityAt).getTime() : 0;
        return applySortDir(la - lb, dir);
      }
      default: return 0;
    }
  });
}

function SortChevron({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  const isActive = col === active;
  const up = isActive && dir === "asc";
  return (
    <span className={`inline-flex flex-col ml-1 -space-y-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity ${isActive ? "opacity-100" : ""}`}>
      <svg width="7" height="5" viewBox="0 0 7 5" className={up || !isActive ? (isActive && up ? "text-slate-900/70" : "text-slate-900/25") : "text-slate-900/25"} fill="currentColor">
        <path d="M3.5 0L7 5H0z" />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" className={!up || !isActive ? (!isActive ? "text-slate-900/25" : "text-slate-900/70") : "text-slate-900/25"} fill="currentColor">
        <path d="M3.5 5L0 0h7z" />
      </svg>
    </span>
  );
}

export function TransactionTable({
  transactions,
  basePath = "/transactions",
  statusFilter = "all",
  showAgencyColumn = false,
  showAssignedToColumn = true,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  statusFilter?: FilesTab;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
}) {
  // Variant B default sort (2026-05-13): Last activity desc — most recent
  // first. asc on the same column = "stalled first" (oldest activity first).
  // No separate top-level "Stalled first" toggle — the sort header does it.
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction per column on first activation. lastActive defaults
      // desc (recent first); the others default asc (alphabetical / earliest).
      setSortDir(key === "lastActive" ? "desc" : "asc");
    }
  }

  const sorted = sortTransactions(transactions, sortKey, sortDir);

  // Tab-aware columns — shared with TransactionRowView so header + rows match.
  const cols = filesColumns(statusFilter, showAssignedToColumn, showAgencyColumn);
  const gridCols = filesGridTemplate(cols);

  // Header meta per column. The exchange/completion header re-labels on the
  // Completed tab, where the date shown is the completion date.
  const COL_HEADER: Record<FilesColumn, { label: string; key: SortKey | null }> = {
    activity: { label: "Last activity", key: "lastActive" },
    target:   { label: statusFilter === "completed" ? "Completion date" : "Exchange target", key: "exchange" },
    status:   { label: "Status", key: "status" },
    assigned: { label: "Assigned to", key: null },
    agency:   { label: "Agency", key: null },
    risk:     { label: "Risk", key: "risk" },
  };

  return (
    // Design Lab: `myfiles-table`. Default v03 (2026-08-09 page pass).
    <GlassCard
      glassId="myfiles-table"
      label="My files · Table"
      defaultVariant="v05"
      style={{ borderRadius: 20, overflow: "hidden" }}
    >
      {/* Header — desktop only. Token-driven background + border (was bg-white/10
       * + border-white/20 Tailwind). Sort buttons keep the hover-reveal chevron
       * pattern but inherit canonical link colour transitions on hover. */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: gridCols,
          background: "rgba(var(--agent-shadow-rgb), 0.04)",
          borderBottom: "0.5px solid var(--agent-border-subtle)",
        }}
      >
        <div />
        {(
          [
            { label: "Property", key: "property" as SortKey | null },
            ...cols.map((c) => COL_HEADER[c]),
          ] as { label: string; key: SortKey | null }[]
        ).map(({ label, key }) =>
          key ? (
            <button
              key={label}
              onClick={() => handleSort(key)}
              className="group/hdr"
              style={{
                padding: "12px 16px",
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.04em",
                color: "var(--agent-text-muted)",
                textAlign: "left",
                display: "flex", alignItems: "center",
                background: "none", border: "none", cursor: "pointer",
                transition: "color 150ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--agent-text-muted)"; }}
            >
              {label}
              <SortChevron col={key} active={sortKey} dir={sortDir} />
            </button>
          ) : (
            <div
              key={label}
              style={{
                padding: "12px 16px",
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.04em",
                color: "var(--agent-text-muted)",
              }}
            >
              {label}
            </div>
          )
        )}
      </div>

      {sorted.map((tx, i) => (
        <TransactionRowView
          key={tx.id}
          tx={tx}
          basePath={basePath}
          isLast={i === sorted.length - 1}
          cols={cols}
          showAgencyColumn={showAgencyColumn}
          showAssignedToColumn={showAssignedToColumn}
        />
      ))}
    </GlassCard>
  );
}

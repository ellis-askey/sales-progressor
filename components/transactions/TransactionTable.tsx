"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateRiskScore } from "@/lib/services/risk";
import { DISPLAY_STAGES } from "@/lib/milestones/display-stages";
import { GlassCard } from "@/components/glass/GlassCard";
import { TransactionRowView, filesColumns, filesGridTemplate, filesGridMinWidth, colLabel } from "@/components/transactions/TransactionRowView";
import { FloatingFilePreview } from "@/components/transactions/FloatingFilePreview";
import { useIsFounder } from "@/components/layout/FounderGate";
import type { TransactionRow, HealthRaw, FilesColumn, FilesTab } from "@/components/transactions/TransactionRowView";
import type { TransactionStatus } from "@prisma/client";

export type { TransactionRow, HealthRaw };

type SortKey =
  | "exchange" | "property" | "status" | "risk" | "lastActive"
  | "stage" | "review" | "paused" | "soldfor" | "completed" | "withdrawnDate";
type SortDir = "asc" | "desc";

// First-click direction per column. Progress shows most-progressed first; dates
// show soonest first; amounts / durations show largest first.
const DEFAULT_DIR: Partial<Record<SortKey, SortDir>> = {
  lastActive: "desc", stage: "desc", paused: "desc", soldfor: "desc",
  completed: "desc", withdrawnDate: "desc",
  exchange: "asc", review: "asc", property: "asc", status: "asc", risk: "asc",
};

// Nulls (missing value) always sort last, whichever direction is active.
function cmpNullable(a: number | null, b: number | null, dir: SortDir, tieA: string, tieB: string): number {
  if (a === null && b === null) return tieA.localeCompare(tieB);
  if (a === null) return 1;
  if (b === null) return -1;
  return applySortDir(a - b, dir);
}
function stageIndex(tx: TransactionRow): number | null {
  if (!tx.boardStage) return null;
  const i = DISPLAY_STAGES.findIndex((s) => s.key === tx.boardStage);
  return i < 0 ? null : i;
}

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
    awaitingDeposit: tx.health.awaitingDeposit, // critique #15
    inChain: tx.health.inChain,
    exchanged: tx.health.exchanged, // critique 2026-10-02
  }).score;
}

function applySortDir(n: number, dir: SortDir) { return dir === "asc" ? n : -n; }

function sortTransactions(rows: TransactionRow[], key: SortKey, dir: SortDir): TransactionRow[] {
  // Risk sort: compute each row's score ONCE here, not inside the comparator
  // (which would recompute calculateRiskScore ~2·N·log N times per sort).
  const riskById = key === "risk" ? new Map(rows.map((r) => [r.id, riskScore(r)])) : null;
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
        return applySortDir((riskById!.get(b.id) ?? 0) - (riskById!.get(a.id) ?? 0), dir);
      case "lastActive": {
        const la = a.health?.lastActivityAt ? new Date(a.health.lastActivityAt).getTime() : 0;
        const lb = b.health?.lastActivityAt ? new Date(b.health.lastActivityAt).getTime() : 0;
        return applySortDir(la - lb, dir);
      }
      case "stage": // Progress / Reached — furthest conveyancing stage reached.
        return cmpNullable(stageIndex(a), stageIndex(b), dir, a.propertyAddress, b.propertyAddress);
      case "review": { // On-hold "Due back" date.
        const da = a.health?.holdInfo?.review ? new Date(a.health.holdInfo.review).getTime() : null;
        const db = b.health?.holdInfo?.review ? new Date(b.health.holdInfo.review).getTime() : null;
        return cmpNullable(da, db, dir, a.propertyAddress, b.propertyAddress);
      }
      case "paused": // On-hold "Paused" — how long it has been held.
        return cmpNullable(a.health?.holdInfo?.days ?? null, b.health?.holdInfo?.days ?? null, dir, a.propertyAddress, b.propertyAddress);
      case "soldfor": { // Completed "Sold for" — agreed price (snapshot wins).
        const pa = a.priceAtExchange ?? a.purchasePrice ?? null;
        const pb = b.priceAtExchange ?? b.purchasePrice ?? null;
        return cmpNullable(pa, pb, dir, a.propertyAddress, b.propertyAddress);
      }
      case "completed": { // Completed date.
        const da = a.completionDate ? new Date(a.completionDate).getTime() : null;
        const db = b.completionDate ? new Date(b.completionDate).getTime() : null;
        return cmpNullable(da, db, dir, a.propertyAddress, b.propertyAddress);
      }
      case "withdrawnDate": { // Withdrawn date (updatedAt stands in).
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : null;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : null;
        return cmpNullable(da, db, dir, a.propertyAddress, b.propertyAddress);
      }
      default: return 0;
    }
  });
}

function SortChevron({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  const isActive = col === active;
  const up = isActive && dir === "asc";
  return (
    <span className={`files-sort-chevron inline-flex flex-col ml-1 -space-y-0.5 opacity-0 group-hover/hdr:opacity-100 group-focus-within/hdr:opacity-100 transition-opacity ${isActive ? "opacity-100" : ""}`}>
      {/* Theme tokens (not slate ink) so the active sort shows on dark glass. */}
      <svg width="7" height="5" viewBox="0 0 7 5" style={{ color: isActive && up ? "var(--agent-text-secondary)" : "var(--agent-text-muted)" }} fill="currentColor">
        <path d="M3.5 0L7 5H0z" />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" style={{ color: isActive && !up ? "var(--agent-text-secondary)" : "var(--agent-text-muted)" }} fill="currentColor">
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
  // Founder preview gate (files redesign, 2026-11-13): the new rows + floating
  // preview + click-to-select are shown to ellis@ only, for prod stress-testing;
  // everyone else gets the classic table and its navigate-on-click behaviour.
  const preview = useIsFounder();
  // Floating preview selection — walks the CURRENT sorted + filtered order.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      // A fresh column resets the sort to its natural first-click direction
      // (see DEFAULT_DIR) — clicking any header clears the previous one.
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key] ?? "asc");
    }
  }

  const sorted = useMemo(() => sortTransactions(transactions, sortKey, sortDir), [transactions, sortKey, sortDir]);

  // Selection over the on-screen order. If the selected file leaves the results
  // (tab / search / filter change) the preview auto-closes — never leave an
  // unrelated property open (founder adjustment, 2026-11-13).
  const selectedIdx = selectedId ? sorted.findIndex((t) => t.id === selectedId) : -1;
  const selectedRow = selectedIdx >= 0 ? sorted[selectedIdx] : null;
  useEffect(() => {
    if (selectedId && selectedIdx < 0) setSelectedId(null);
  }, [selectedId, selectedIdx]);

  // Tab-aware columns — shared with TransactionRowView so header + rows match.
  const cols = filesColumns(statusFilter, showAssignedToColumn, showAgencyColumn, preview);
  const gridCols = filesGridTemplate(cols);

  // Card ↔ grid switch bucket: the smallest container-query threshold that
  // fits this column set (fixed tracks + a readable property column). The
  // matching @container rules live in agent-system.css (.files-switch-N) —
  // keep SWITCH_BUCKETS in step with them.
  const SWITCH_BUCKETS = [680, 800, 920, 1040, 1160];
  const switchBucket = SWITCH_BUCKETS.find((b) => b >= filesGridMinWidth(cols)) ?? 1160;

  // Which columns are sortable (labels come from COL_LABEL, shared with the row).
  const COL_SORT: Partial<Record<FilesColumn, SortKey>> = {
    stage: "stage", activity: "lastActive", exchange: "exchange", keydate: "exchange",
    review: "review", paused: "paused",
    soldfor: "soldfor", exchanged: "exchange", completed: "completed",
    reached: "stage", withdrawnDate: "withdrawnDate",
  };

  return (
    <>
    {/* Design Lab: `myfiles-table`. Default v03 (2026-08-09 page pass). */}
    <GlassCard
      glassId="myfiles-table"
      label="My files · Table"
      defaultVariant="v05"
      className={`files-table files-switch-${switchBucket}${preview && selectedRow ? " files-table--preview" : ""}`}
      style={{ borderRadius: 20, overflow: "hidden" }}
    >
      {/* Header — desktop only. Token-driven background + border (was bg-white/10
       * + border-white/20 Tailwind). Sort buttons keep the hover-reveal chevron
       * pattern but inherit canonical link colour transitions on hover. */}
      <div
        className="files-row-grid"
        style={{
          gridTemplateColumns: gridCols,
          background: "rgba(var(--agent-shadow-rgb), 0.04)",
          borderBottom: "0.5px solid var(--agent-border-subtle)",
        }}
      >
        {(
          [
            { label: "Property", key: "property" as SortKey | null },
            ...cols.map((c) => ({ label: colLabel(c, preview), key: COL_SORT[c] ?? null })),
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
              onFocus={(e) => { e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
              onBlur={(e) => { e.currentTarget.style.color = "var(--agent-text-muted)"; }}
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
          activeTab={statusFilter}
          showAgencyColumn={showAgencyColumn}
          showAssignedToColumn={showAssignedToColumn}
          onSelect={preview ? setSelectedId : undefined}
          selected={preview && tx.id === selectedId}
        />
      ))}
    </GlassCard>

    {preview && (
      <FloatingFilePreview
        row={selectedRow}
        open={!!selectedRow}
        basePath={basePath}
        onClose={() => setSelectedId(null)}
        onPrev={() => { if (selectedIdx > 0) setSelectedId(sorted[selectedIdx - 1].id); }}
        onNext={() => { if (selectedIdx >= 0 && selectedIdx < sorted.length - 1) setSelectedId(sorted[selectedIdx + 1].id); }}
        hasPrev={selectedIdx > 0}
        hasNext={selectedIdx >= 0 && selectedIdx < sorted.length - 1}
      />
    )}
    </>
  );
}

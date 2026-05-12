"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { TransactionTable } from "./TransactionTable";
import type { TransactionRow } from "./TransactionTable";
import { calculateRiskScore } from "@/lib/services/risk";
import type { RiskLevel } from "@/lib/services/risk";
import { extractFirstName } from "@/lib/contacts/displayName";

// ── Chip sub-components ────────────────────────────────────────────────────

/**
 * Shared chip-dropdown hook — opens via portal to document.body to escape
 * any ancestor overflow:hidden / sticky stacking context (work-queue B1+B2
 * lesson). Auto-closes on click-outside + on scroll.
 *
 * Click-outside listener checks BOTH `ref` (trigger wrapper) and `popoverRef`
 * (portal'd dropdown) — without the popoverRef check, native mousedown on a
 * dropdown item synchronously triggers setOpen(false) BEFORE React's onClick
 * fires, racing the dropdown into unmount before the item's click can
 * register. Same pattern used by RiskBadgeWithPopover.
 */
function useChipDropdown() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);
  function openDropdown() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }
  return { open, pos, ref, popoverRef, openDropdown, setOpen };
}

function AssignedToChip({ users, selected, onChange }: {
  users: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const { open, pos, ref, popoverRef, openDropdown, setOpen } = useChipDropdown();
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const firstName = selectedUser ? extractFirstName(selectedUser.name) : null;
  const isActive = selected !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {isActive ? `Owner: ${firstName}` : "Owner"}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(null); setOpen(false); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear owner filter"
            style={{ width: 16, height: 16, fontSize: 12, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popoverRef} className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 180,
        }}>
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="agent-dropdown-item"
            style={{ fontWeight: !selected ? 600 : undefined }}
          >
            All owners
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setOpen(false); }}
              className="agent-dropdown-item"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: selected === u.id ? 600 : undefined }}
            >
              {u.name}
              {selected === u.id && <span style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const RISK_LABEL: Record<RiskLevel, string> = { low: "On track", medium: "Watch", high: "At risk", no_data: "No data" };
const RISK_COLOR: Record<RiskLevel, string> = { low: "text-emerald-700", medium: "text-amber-700", high: "text-red-700", no_data: "text-slate-400" };

function RiskChip({ selected, onToggle }: {
  selected: Set<RiskLevel>;
  onToggle: (level: RiskLevel) => void;
}) {
  const { open, pos, ref, popoverRef, openDropdown } = useChipDropdown();
  const isActive = selected.size > 0;
  const label = isActive
    ? `Risk: ${[...selected].map((l) => RISK_LABEL[l]).join(", ")}`
    : "Risk";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
      >
        {label}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popoverRef} className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 170, padding: "4px 0",
        }}>
          {(["low", "medium", "high"] as RiskLevel[]).map((level) => {
            const checked = selected.has(level);
            return (
              <button
                key={level}
                onClick={() => onToggle(level)}
                className="agent-dropdown-item"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  background: checked ? "var(--agent-coral-deep)" : "transparent",
                  border: `1px solid ${checked ? "var(--agent-coral-deep)" : "rgba(0,0,0,0.20)"}`,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <span style={{ color: "white", fontSize: 9, lineHeight: 1 }}>✓</span>}
                </span>
                {/* OLD: "{RISK_LABEL[level]} risk" rendered as "On track risk" /
                    "At risk risk" — grammar bug. Stage 3 voice fix: drop the
                    trailing " risk" suffix; RISK_LABEL values are full phrases. */}
                <span className={checked ? RISK_COLOR[level] : ""} style={!checked ? { color: "var(--agent-text-secondary)" } : undefined}>
                  {RISK_LABEL[level]}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function ManagedByChip({ value, onChange }: {
  value: "all" | "self_managed" | "outsourced";
  onChange: (v: "all" | "self_managed" | "outsourced") => void;
}) {
  const { open, pos, ref, popoverRef, openDropdown, setOpen } = useChipDropdown();
  const isActive = value !== "all";
  // Voice fix (Stage 3, pre-flagged 3 + 4): translation table per VOICE_GUIDELINES.md
  //   OLD: "Self-progressed" → "Managed by you"
  //   OLD: "With progressor" → "Our team is handling"
  const label = value === "self_managed" ? "Managed by you"
    : value === "outsourced" ? "Our team is handling"
    : "Managed by";

  const opts: { value: "all" | "self_managed" | "outsourced"; label: string }[] = [
    { value: "all",          label: "All" },
    { value: "self_managed", label: "Managed by you" },
    { value: "outsourced",   label: "Our team is handling" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {label}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange("all"); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange("all"); setOpen(false); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear managed-by filter"
            style={{ width: 16, height: 16, fontSize: 12, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popoverRef} className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 200,
        }}>
          {opts.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="agent-dropdown-item"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: value === opt.value ? 600 : undefined }}
            >
              {opt.label}
              {value === opt.value && <span style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function TransactionListWithSearch({
  transactions,
  basePath = "/transactions",
  isDirector = false,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  isDirector?: boolean;
})
 {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<Set<RiskLevel>>(new Set());
  const [managedByFilter, setManagedByFilter] = useState<"all" | "self_managed" | "outsourced">("all");

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    const users: { id: string; name: string }[] = [];
    for (const t of transactions) {
      if (t.agentUser && !seen.has(t.agentUser.id)) {
        seen.add(t.agentUser.id);
        users.push(t.agentUser);
      }
    }
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  // Director sees the Owner chip whenever there is at least one assigned owner
  // in the visible set — preserves the affordance after hub-filter narrowing
  // (e.g. clicking "X exchanging this week" on /agent/hub lands on a view where
  // narrowed files often have one shared owner; without this director path, the
  // chip would auto-hide). Negotiators keep the original > 1 logic: chip hides
  // when there's nothing meaningful to filter by (they see only their own files).
  const showUserFilter = isDirector
    ? uniqueUsers.length > 0
    : uniqueUsers.length > 1;

  const showManagedByFilter = useMemo(
    () =>
      transactions.some((t) => t.serviceType === "self_managed") &&
      transactions.some((t) => t.serviceType === "outsourced"),
    [transactions]
  );

  function toggleRiskLevel(level: RiskLevel) {
    setSelectedRiskLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  const anyFilterActive =
    selectedUserId !== null || selectedRiskLevels.size > 0 || managedByFilter !== "all";

  function clearAllFilters() {
    setSelectedUserId(null);
    setSelectedRiskLevels(new Set());
    setManagedByFilter("all");
    setQuery("");
  }

  const filtered = useMemo(() => {
    let result = transactions;

    if (selectedUserId) {
      result = result.filter((t) => t.agentUser?.id === selectedUserId);
    }

    if (selectedRiskLevels.size > 0) {
      result = result.filter((t) => {
        const level: RiskLevel = t.health
          ? calculateRiskScore({
              onTrack: t.health.onTrack ?? "unknown",
              escalatedTaskCount: t.health.escalatedTasks,
              overdueTaskCount: t.health.pendingOverdueTasks,
              daysSinceLastActivity: t.health.lastActivityAt
                ? Math.floor((Date.now() - new Date(t.health.lastActivityAt).getTime()) / 86400000)
                : null,
              daysStuckOnMilestone: t.health.daysStuckOnMilestone,
            }).level
          : "low";
        return selectedRiskLevels.has(level);
      });
    }

    if (managedByFilter !== "all") {
      result = result.filter((t) => t.serviceType === managedByFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) result = result.filter((t) => t.propertyAddress.toLowerCase().includes(q));

    return result;
  }, [transactions, selectedUserId, selectedRiskLevels, managedByFilter, query]);

  const showChipRow = showUserFilter || showManagedByFilter || true; // Risk chip always shown

  return (
    <div className="space-y-3">
      {/* Search + filter chips — agent-glass-strong wrapper for surface parity with
       * FileAlertsStrip / status-tabs / table below. Solid-mode override inherits
       * via globals.css [data-solid] .agent-glass-strong rule. */}
      <div className="agent-glass-strong" style={{ padding: "12px 14px", borderRadius: "var(--agent-radius-xl)", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Search input — agent-input agent-input-sm with fontSize: 13 override
         * (matches work-queue precedent — agent-input-sm forces max(16px, body-sm)
         * which reads oversized on desktop search). Embedded search icon + clear
         * button (agent-icon-btn-sm) preserved. */}
        <div style={{ position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--agent-text-muted)", pointerEvents: "none" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by address…"
            className="agent-input agent-input-sm"
            style={{ width: "100%", paddingLeft: 34, paddingRight: 34, fontSize: 13 }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
              aria-label="Clear search"
            >×</button>
          )}
        </div>

        {/* Filter chips — implementations transplanted in Section 6 */}
        {showChipRow && (
          <div className="flex items-center gap-2 flex-wrap">
            {showUserFilter && (
              <AssignedToChip
                users={uniqueUsers}
                selected={selectedUserId}
                onChange={setSelectedUserId}
              />
            )}
            <RiskChip selected={selectedRiskLevels} onToggle={toggleRiskLevel} />
            {showManagedByFilter && (
              <ManagedByChip value={managedByFilter} onChange={setManagedByFilter} />
            )}
            {anyFilterActive && (
              <button
                onClick={clearAllFilters}
                className="agent-link agent-link-muted"
                style={{ fontSize: 12, marginLeft: 4 }}
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="agent-glass-strong" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
          {/* OLD: "No files match the active filters." — Stage 3 voice fix (Rule 3):
              drop the passive pointer to "the active filters" — agent already knows
              what filter is on; same precedent as work-queue Stage 3 fix. */}
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--agent-text-muted)" }}>
            {query
              ? `No files match "${query}"`
              : "No files match."}
          </p>
          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="agent-link agent-link-muted"
              style={{ fontSize: 12 }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <TransactionTable transactions={filtered} basePath={basePath} showOwner={isDirector && selectedUserId === null} />
      )}
    </div>
  );
}

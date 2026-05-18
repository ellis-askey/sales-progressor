"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Funnel } from "@phosphor-icons/react/dist/ssr";
import { TransactionTable } from "./TransactionTable";
import type { TransactionRow } from "./TransactionTable";
import { activityStateFor, type ActivityState } from "./TransactionRowView";
import { calculateRiskScore } from "@/lib/services/risk";
import type { RiskLevel } from "@/lib/services/risk";
import { extractFirstName } from "@/lib/contacts/displayName";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

// ── Chip dropdown infrastructure ───────────────────────────────────────────

/**
 * Shared chip-dropdown hook — opens via portal to document.body to escape
 * any ancestor overflow:hidden / sticky stacking context (work-queue B1+B2
 * lesson). Auto-closes on click-outside + on scroll.
 *
 * Exit animation (2026-05-12): a `closing` flag keeps the dropdown mounted
 * for the duration of .agent-dropdown-out (100ms ease-in), then unmounts
 * via onAnimationEnd. Mirrors .agent-reveal-out pattern. Eliminates the
 * pop-out "jump" that previous instant-unmount behaviour produced.
 *
 * Click-outside listener checks BOTH `ref` (trigger wrapper) and `popoverRef`
 * (portal'd dropdown) — without the popoverRef check, native mousedown on a
 * dropdown item synchronously triggers close BEFORE React's onClick fires,
 * racing the dropdown into unmount before the item's click can register.
 */
function useChipDropdown() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const theme = usePortalTheme();

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      close();
    }
    function handleScroll() { close(); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setOpen((wasOpen) => {
      if (wasOpen) setClosing(true);
      return false;
    });
  }
  function openDropdown() {
    if (open) {
      close();
    } else {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left });
      }
      setClosing(false);
      setOpen(true);
    }
  }
  function onClosedAnim() {
    setClosing(false);
  }

  return { open, closing, pos, ref, popoverRef, theme, openDropdown, close, onClosedAnim };
}

function dropdownClass(closing: boolean): string {
  return closing ? "agent-dropdown-out" : "agent-dropdown-in";
}

// ── Chip sub-components ────────────────────────────────────────────────────

function AssignedToChip({ users, selected, onChange }: {
  users: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const { open, closing, pos, ref, popoverRef, theme, openDropdown, close, onClosedAnim } = useChipDropdown();
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const firstName = selectedUser ? extractFirstName(selectedUser.name) : null;
  const isActive = selected !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-tab tl-bar-chip${isActive ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {isActive ? `Owner: ${firstName}` : "Owner"}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(null); close(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(null); close(); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear owner filter"
            style={{ width: 14, height: 14, fontSize: 10, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          data-theme={theme}
          className={dropdownClass(closing)}
          onAnimationEnd={() => { if (closing) onClosedAnim(); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 180,
          }}
        >
          <button
            onClick={() => { onChange(null); close(); }}
            className="agent-dropdown-item"
            style={{ fontWeight: !selected ? 600 : undefined }}
          >
            All owners
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); close(); }}
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

function RiskChip({ selected, onToggle, onClear }: {
  selected: Set<RiskLevel>;
  onToggle: (level: RiskLevel) => void;
  onClear: () => void;
}) {
  const { open, closing, pos, ref, popoverRef, theme, openDropdown, close, onClosedAnim } = useChipDropdown();
  const isActive = selected.size > 0;
  const label = isActive
    ? `Risk: ${[...selected].map((l) => RISK_LABEL[l]).join(", ")}`
    : "Risk";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-tab tl-bar-chip${isActive ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {label}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); close(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClear(); close(); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear risk filter"
            style={{ width: 14, height: 14, fontSize: 10, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          data-theme={theme}
          className={dropdownClass(closing)}
          onAnimationEnd={() => { if (closing) onClosedAnim(); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 170, padding: "4px 0",
          }}
        >
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

function ManagedByChip({ value, onChange, variant = "agent" }: {
  value: "all" | "self_managed" | "outsourced";
  onChange: (v: "all" | "self_managed" | "outsourced") => void;
  variant?: "agent" | "admin";
}) {
  const { open, closing, pos, ref, popoverRef, theme, openDropdown, close, onClosedAnim } = useChipDropdown();
  const isActive = value !== "all";

  const opts: { value: "all" | "self_managed" | "outsourced"; label: string }[] = variant === "admin"
    ? [
        { value: "all",          label: "All" },
        { value: "self_managed", label: "Self-managed" },
        { value: "outsourced",   label: "Outsourced to us" },
      ]
    : [
        { value: "all",          label: "All" },
        { value: "self_managed", label: "Managed by you" },
        { value: "outsourced",   label: "Our team is handling" },
      ];

  const inactiveLabel = variant === "admin" ? "Service type" : "Managed by";
  const label = isActive
    ? (opts.find((o) => o.value === value)?.label ?? inactiveLabel)
    : inactiveLabel;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-tab tl-bar-chip${isActive ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {label}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange("all"); close(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange("all"); close(); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear managed-by filter"
            style={{ width: 14, height: 14, fontSize: 10, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          data-theme={theme}
          className={dropdownClass(closing)}
          onAnimationEnd={() => { if (closing) onClosedAnim(); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 200,
          }}
        >
          {opts.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); close(); }}
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

/* ActivityFilterChip — Variant B IA (2026-05-13). Multi-select dropdown over
 * Moving / Stalled / Stale buckets. Filter logic compares each row's
 * activityStateFor(health.lastActivityAt) against the selected set. */
const ACTIVITY_LABEL: Record<ActivityState, string> = {
  moving: "Moving", stalled: "Stalled", stale: "Stale",
};
const ACTIVITY_HINT: Record<ActivityState, string> = {
  moving: "Active in last 7 days",
  stalled: "7–14 days quiet",
  stale: "14+ days quiet",
};

function ActivityFilterChip({ selected, onToggle, onClear }: {
  selected: Set<ActivityState>;
  onToggle: (s: ActivityState) => void;
  onClear: () => void;
}) {
  const { open, closing, pos, ref, popoverRef, theme, openDropdown, close, onClosedAnim } = useChipDropdown();
  const isActive = selected.size > 0;
  const label = isActive
    ? `Activity: ${[...selected].map((s) => ACTIVITY_LABEL[s]).join(", ")}`
    : "Activity";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-tab tl-bar-chip${isActive ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {label}
        {isActive && (
          <span
            role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); close(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClear(); close(); } }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label="Clear activity filter"
            style={{ width: 14, height: 14, fontSize: 10, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          data-theme={theme}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) onClosedAnim(); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 200, padding: "4px 0",
          }}
        >
          {(["moving", "stalled", "stale"] as ActivityState[]).map((s) => {
            const checked = selected.has(s);
            return (
              <button
                key={s}
                onClick={() => onToggle(s)}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ color: "var(--agent-text-primary)", fontSize: 12 }}>{ACTIVITY_LABEL[s]}</span>
                  <span style={{ color: "var(--agent-text-muted)", fontSize: 10 }}>{ACTIVITY_HINT[s]}</span>
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

// Includes "draft" for type compatibility with TransactionStatus | "all" from
// the server. Draft is never rendered as a tab (omitted from STATUS_TABS below).
type StatusValue = "all" | "draft" | "active" | "on_hold" | "completed" | "withdrawn";

export function TransactionListWithSearch({
  transactions,
  basePath = "/transactions",
  isDirector = false,
  statusFilter,
  statusCounts,
  showStatusTabs = true,
  showAgencyColumn = false,
  showAssignedToColumn = true,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  isDirector?: boolean;
  statusFilter?: StatusValue;
  statusCounts?: { all: number; active: number; on_hold: number; completed: number; withdrawn: number };
  showStatusTabs?: boolean;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<Set<RiskLevel>>(new Set());
  const [activityFilter, setActivityFilter] = useState<Set<ActivityState>>(new Set());
  const [managedByFilter, setManagedByFilter] = useState<"all" | "self_managed" | "outsourced">("all");

  function toggleActivityState(s: ActivityState) {
    setActivityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

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

  // Director sees the Managed-by chip whenever there is at least one file in
  // the visible set — preserves the affordance after narrowing (month-pill
  // click, hub-filter, etc.). Same narrowing-scope fix as showUserFilter above
  // (locked 2026-05-11, extended here 2026-05-12). Negotiators keep the
  // original logic: chip only shows when there are BOTH self_managed AND
  // outsourced files in the visible set.
  const showManagedByFilter = useMemo(
    () => isDirector
      ? transactions.length > 0
      : transactions.some((t) => t.serviceType === "self_managed") &&
        transactions.some((t) => t.serviceType === "outsourced"),
    [transactions, isDirector]
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
    selectedUserId !== null
    || selectedRiskLevels.size > 0
    || activityFilter.size > 0
    || managedByFilter !== "all";

  function clearAllFilters() {
    setSelectedUserId(null);
    setSelectedRiskLevels(new Set());
    setActivityFilter(new Set());
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

    if (activityFilter.size > 0) {
      result = result.filter((t) => {
        const s = activityStateFor(t.health?.lastActivityAt);
        return s !== null && activityFilter.has(s);
      });
    }

    if (managedByFilter !== "all") {
      result = result.filter((t) => t.serviceType === managedByFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) result = result.filter((t) => t.propertyAddress.toLowerCase().includes(q));

    return result;
  }, [transactions, selectedUserId, selectedRiskLevels, activityFilter, managedByFilter, query]);

  // Hanging-basket bar — single surface containing status tabs (LEFT) and
  // filter-chip triggers (RIGHT). Mirrors PropertyFileTabs visual pattern:
  // agent-glass-strong card, .agent-tab-bar agent-tab-bar-static for the tab
  // rail, hover-preview underline via the canonical class. Mobile: bar wraps
  // to a second row when status tabs + chips can't fit a single line.
  const STATUS_TABS: { value: Exclude<StatusValue, "draft">; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On hold" },
    { value: "completed", label: "Completed" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  return (
    <div className="space-y-3">
      {/* Paired card — single outer card, white search top half + lighter tabs bottom half.
       * Mirrors the property-detail hero+tabs pattern: one card, two sections, hairline
       * divider at the seam, rounded corners across the whole shape. */}
      <div className="tl-card">
        {/* TOP HALF (Variant B IA, 2026-05-13) — search input (shorter) + filter
         * chips inline on a single row. Chip set: Owner (director) + Risk +
         * Activity + Managed-by (director). Negotiators see 3 chips, directors
         * see 4. */}
        <div className="tl-card-search tl-search-row">
          <div className="tl-search-input">
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

          <div className="tl-search-chips">
            {showUserFilter && (
              <AssignedToChip
                users={uniqueUsers}
                selected={selectedUserId}
                onChange={setSelectedUserId}
              />
            )}
            <RiskChip
              selected={selectedRiskLevels}
              onToggle={toggleRiskLevel}
              onClear={() => setSelectedRiskLevels(new Set())}
            />
            <ActivityFilterChip
              selected={activityFilter}
              onToggle={toggleActivityState}
              onClear={() => setActivityFilter(new Set())}
            />
            {showManagedByFilter && (
              <ManagedByChip
                value={managedByFilter}
                onChange={setManagedByFilter}
                variant={showAgencyColumn && showAssignedToColumn ? "admin" : "agent"}
              />
            )}
            {anyFilterActive && (
              <button
                onClick={clearAllFilters}
                className="agent-link agent-link-muted tl-bar-clear"
                aria-label="Clear all filters"
              >
                Clear filter
              </button>
            )}
            {/* Filter signpost — decorative trailing icon (2026-05-13). Goes
             * coral when any chip is active to mirror the chip state. */}
            <Funnel
              weight={anyFilterActive ? "fill" : "regular"}
              size={14}
              aria-hidden
              style={{
                marginLeft: 4,
                color: anyFilterActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                flexShrink: 0,
              }}
            />
          </div>
        </div>

        {/* BOTTOM HALF — status tabs alone, full-width row (per Ellis override 1,
         * 2026-05-13). Tabs stay below the search/chips row on their own line. */}
        {showStatusTabs && statusCounts && (
          <div className="tl-card-tabs">
            <div className="agent-tab-bar agent-tab-bar-static tl-bar-row">
              <div className="tl-bar-tabs">
                {STATUS_TABS.map(({ value, label }) => {
                  const isActive = statusFilter === value;
                  const count = statusCounts[value];
                  const href = value === "active" ? basePath : `${basePath}?filter=${value}`;
                  return (
                    <Link
                      key={value}
                      href={href}
                      scroll={false}
                      className="agent-tab"
                      aria-selected={isActive || undefined}
                      style={{ textDecoration: "none" }}
                    >
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 500,
                        padding: "1px 7px", borderRadius: 99,
                        background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
                        color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                      }}>{count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="agent-glass-strong" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
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
        <TransactionTable transactions={filtered} basePath={basePath} showAgencyColumn={showAgencyColumn} showAssignedToColumn={showAssignedToColumn} />
      )}
    </div>
  );
}

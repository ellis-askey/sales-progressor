"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { TransactionTable } from "./TransactionTable";
import type { TransactionRow } from "./TransactionTable";
import { calculateRiskScore } from "@/lib/services/risk";
import type { RiskLevel } from "@/lib/services/risk";
import { extractFirstName } from "@/lib/contacts/displayName";

// ── Chip sub-components ────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onClose]);
}

const chipBase = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer";
const chipDefault = "bg-white/40 text-slate-900/50 border-slate-900/10 hover:border-slate-900/20 hover:text-slate-900/70";
const chipActive = "bg-orange-50 text-orange-700 border-orange-200";

function ChevronDown() {
  return (
    <svg width="9" height="6" viewBox="0 0 9 6" fill="currentColor" style={{ opacity: 0.45, flexShrink: 0 }}>
      <path d="M0 0l4.5 6L9 0z" />
    </svg>
  );
}

function AssignedToChip({ users, selected, onChange }: {
  users: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const firstName = selectedUser ? extractFirstName(selectedUser.name) : null;
  const isActive = selected !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${chipBase} ${isActive ? chipActive : chipDefault}`}
      >
        {isActive ? `Owner: ${firstName}` : "Owner"}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            className="text-orange-400 hover:text-orange-600 leading-none ml-0.5"
          >
            ×
          </span>
        ) : (
          <ChevronDown />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[160px]">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!selected ? "font-semibold text-slate-900/80" : "text-slate-900/55"}`}
          >
            All owners
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 ${selected === u.id ? "font-semibold text-slate-900/80" : "text-slate-900/55"}`}
            >
              {u.name}
              {selected === u.id && <span className="text-orange-500 flex-shrink-0">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RISK_LABEL: Record<RiskLevel, string> = { low: "On track", medium: "Watch", high: "At risk" };
const RISK_COLOR: Record<RiskLevel, string> = { low: "text-emerald-700", medium: "text-amber-700", high: "text-red-700" };

function RiskChip({ selected, onToggle }: {
  selected: Set<RiskLevel>;
  onToggle: (level: RiskLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const isActive = selected.size > 0;
  const label = isActive
    ? `Risk: ${[...selected].map((l) => RISK_LABEL[l]).join(", ")}`
    : "Risk";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${chipBase} ${isActive ? chipActive : chipDefault}`}
      >
        {label}
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[150px]">
          {(["low", "medium", "high"] as RiskLevel[]).map((level) => {
            const checked = selected.has(level);
            return (
              <button
                key={level}
                onClick={() => onToggle(level)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2"
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${checked ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}>
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className={checked ? RISK_COLOR[level] : "text-slate-900/60"}>
                  {RISK_LABEL[level]} risk
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManagedByChip({ value, onChange }: {
  value: "all" | "self_managed" | "outsourced";
  onChange: (v: "all" | "self_managed" | "outsourced") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const isActive = value !== "all";
  const label = value === "self_managed" ? "Self-progressed"
    : value === "outsourced" ? "With progressor"
    : "Managed by";

  const opts: { value: "all" | "self_managed" | "outsourced"; label: string }[] = [
    { value: "all",          label: "All" },
    { value: "self_managed", label: "Self-progressed" },
    { value: "outsourced",   label: "With progressor" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${chipBase} ${isActive ? chipActive : chipDefault}`}
      >
        {label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange("all"); setOpen(false); }}
            className="text-orange-400 hover:text-orange-600 leading-none ml-0.5"
          >
            ×
          </span>
        ) : (
          <ChevronDown />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[160px]">
          {opts.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 ${value === opt.value ? "font-semibold text-slate-900/80" : "text-slate-900/55"}`}
            >
              {opt.label}
              {value === opt.value && <span className="text-orange-500 flex-shrink-0">✓</span>}
            </button>
          ))}
        </div>
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

  const showUserFilter = uniqueUsers.length > 1;

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
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-900/30 pointer-events-none"
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
          className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900/30 hover:text-slate-900/60"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter chips */}
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
              className="text-xs text-slate-900/35 hover:text-slate-900/65 transition-colors ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/40 mb-2">
            {query
              ? `No files match "${query}"`
              : "No files match the active filters."}
          </p>
          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-blue-500 hover:text-blue-600"
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

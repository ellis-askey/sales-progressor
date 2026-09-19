"use client";

// All Files → List view. The list owns only what belongs to a list: an address
// search, the status tabs (which slice of the book), and sort (inside
// TransactionTable). Every smart-filter lens — ownership, service, and the
// problem lenses — lives in the one Filter menu on the workspace bar
// (FilesWorkspace + FilterMenu), so there is a single filter system, not two.

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { TransactionTable } from "./TransactionTable";
import type { TransactionRow } from "./TransactionTable";

// Includes "draft" for type compatibility with TransactionStatus | "all" from
// the server. Draft is never rendered as a tab (omitted from STATUS_TABS below).
type StatusValue = "all" | "draft" | "active" | "on_hold" | "completed" | "withdrawn";

export function TransactionListWithSearch({
  transactions,
  basePath = "/transactions",
  initialStatus,
  showStatusTabs = true,
  showAgencyColumn = false,
  showAssignedToColumn = true,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  initialStatus?: StatusValue;
  showStatusTabs?: boolean;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
}) {
  // Status tab is client state — switching filters the already-loaded set
  // instantly, with no server round-trip. The URL is kept in sync via
  // history.replaceState so a refresh / bookmark lands on the same tab.
  const [status, setStatus] = useState<StatusValue>(initialStatus ?? "active");
  const [query, setQuery] = useState("");

  // Counts for the tab badges — derived from the full set the client holds, so
  // they're always in sync with what a tab would show.
  const statusCounts = useMemo(() => ({
    all: transactions.length,
    active: transactions.filter((t) => t.status === "active").length,
    on_hold: transactions.filter((t) => t.status === "on_hold").length,
    completed: transactions.filter((t) => t.status === "completed").length,
    withdrawn: transactions.filter((t) => t.status === "withdrawn").length,
  }), [transactions]);

  function selectStatus(value: Exclude<StatusValue, "draft">) {
    setStatus(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (value === "active") url.searchParams.delete("filter");
      else url.searchParams.set("filter", value);
      window.history.replaceState(null, "", url.toString());
    }
  }

  const filtered = useMemo(() => {
    let result = transactions;
    if (showStatusTabs && status !== "all") {
      result = result.filter((t) => t.status === status);
    }
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((t) => t.propertyAddress.toLowerCase().includes(q));
    return result;
  }, [transactions, status, showStatusTabs, query]);

  const STATUS_TABS: { value: Exclude<StatusValue, "draft">; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On hold" },
    { value: "completed", label: "Completed" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  return (
    <div className="space-y-3">
      {/* Paired card — white search top half + lighter tabs bottom half, one
       * card, hairline divider at the seam. */}
      <GlassCard glassId="myfiles-search" label="My files · Search & tabs" defaultVariant="v25" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
        <div className="tl-card-search tl-search-row">
          <div className="tl-search-input" style={{ flex: 1 }}>
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
        </div>

        {showStatusTabs && (
          <div className="tl-card-tabs">
            <div className="agent-tab-bar agent-tab-bar-static tl-bar-row">
              <div className="tl-bar-tabs">
                {STATUS_TABS.map(({ value, label }) => {
                  const isActive = status === value;
                  const count = statusCounts[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectStatus(value)}
                      className="agent-tab"
                      aria-selected={isActive || undefined}
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 500,
                        padding: "1px 7px", borderRadius: 99,
                        background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
                        color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="agent-glass-strong" style={{ padding: "32px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--agent-text-muted)" }}>
            {query
              ? `No files match "${query}"`
              : showStatusTabs && status !== "all"
                ? `No ${status.replace("_", "-")} files`
                : "No files match."}
          </p>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="agent-link agent-link-muted"
              style={{ fontSize: 12 }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <TransactionTable
          transactions={filtered}
          basePath={basePath}
          statusFilter={showStatusTabs ? status : "all"}
          showAgencyColumn={showAgencyColumn}
          showAssignedToColumn={showAssignedToColumn}
        />
      )}
    </div>
  );
}

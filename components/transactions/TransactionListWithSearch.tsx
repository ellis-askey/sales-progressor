"use client";

// All Files → List view. The list owns only what belongs to a list: an address
// search, the status tabs (which slice of the book), and sort (inside
// TransactionTable). Every smart-filter lens — ownership, service, and the
// problem lenses — lives in the one Filter menu on the workspace bar
// (FilesWorkspace + FilterMenu), so there is a single filter system, not two.

import { useState, useMemo, useEffect } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchTabsBar } from "@/components/ui/SearchTabsBar";
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
  onStatusChange,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  initialStatus?: StatusValue;
  showStatusTabs?: boolean;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
  // Reports the active status tab up so the workspace Filter menu can count
  // each lens against the slice you're actually looking at.
  onStatusChange?: (status: StatusValue) => void;
}) {
  // Status tab is client state — switching filters the already-loaded set
  // instantly, with no server round-trip. The URL is kept in sync via
  // history.replaceState so a refresh / bookmark lands on the same tab.
  const [status, setStatus] = useState<StatusValue>(initialStatus ?? "active");
  const [query, setQuery] = useState("");

  // Keep the workspace in step with the visible tab (for filter-menu counts).
  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

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
      {/* Canonical search + tabs paired card (components/ui/SearchTabsBar). */}
      <SearchTabsBar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by address…"
        glassId="myfiles-search"
        glassLabel="My files · Search & tabs"
        tabs={showStatusTabs ? STATUS_TABS.map((t) => ({ value: t.value, label: t.label, count: statusCounts[t.value] })) : undefined}
        activeTab={status}
        onTabChange={(v) => selectStatus(v as Exclude<StatusValue, "draft">)}
      />

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", padding: "20px 24px" }}>
          <EmptyState
            icon={<MagnifyingGlass size={24} weight="regular" />}
            title={query ? "No matches" : "Nothing here"}
            description={query
              ? `No files match "${query}".`
              : showStatusTabs && status !== "all"
                ? `No ${status.replace("_", "-")} files right now.`
                : "No files match."}
            action={query ? (
              <button onClick={() => setQuery("")} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
                Clear search
              </button>
            ) : undefined}
          />
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

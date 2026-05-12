import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { listTransactions, countTransactionsByStatus, getExchangeForecast } from "@/lib/services/transactions";
import { getHubFilteredIds, getMonthExchangingIds, type HubFilter } from "@/lib/services/hub";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { ForecastStrip } from "@/components/transactions/ForecastStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import { Plus, HouseLine } from "@phosphor-icons/react/dist/ssr";
import { X } from "lucide-react";
import type { TransactionStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "All Files · Sales Progressor",
};

const HUB_FILTER_VALUES = [
  "exchanging-this-week",
  "completing-this-week",
  "closing-this-month",
  "exchanging-next-30-days",
] as const;

function isHubFilter(v: string | undefined): v is HubFilter {
  return HUB_FILTER_VALUES.includes(v as HubFilter);
}

// Validates ?exchanging=YYYY-MM (1-indexed month, zero-padded). Returns a
// JS-convention 0-indexed month for downstream Date construction, or null.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
function parseMonthFilter(v: string | undefined): { year: number; month: number; key: string } | null {
  if (!v || !MONTH_RE.test(v)) return null;
  const [y, m] = v.split("-").map(Number);
  return { year: y, month: m - 1, key: v };
}

const FILTER_LABELS: Record<HubFilter, string> = {
  "exchanging-this-week": "Exchanging this week",
  "completing-this-week": "Completing this week",
  "closing-this-month": "Closing this month",
  "exchanging-next-30-days": "Exchanging in the next 30 days",
};

const FILTER_EMPTY: Record<HubFilter, { title: string; description: string }> = {
  "exchanging-this-week": {
    title: "No files exchanging this week",
    description:
      "Files appear here when their expected exchange date is within the next 7 days.",
  },
  "completing-this-week": {
    title: "No files completing this week",
    description:
      "Files appear here when their completion date is within the next 7 days.",
  },
  "closing-this-month": {
    title: "No files closing this month",
    description:
      "Files appear here when their expected exchange date falls within the current calendar month.",
  },
  "exchanging-next-30-days": {
    title: "No files exchanging in the next 30 days",
    description:
      "Files appear here when their expected exchange date is within the next 30 days.",
  },
};

export default async function AllTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; exchanging?: string }>;
}) {
  const session = await requireSession();
  const { filter, exchanging } = await searchParams;

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const opts = vis.seeAll ? { allAgentFiles: true, firmName: vis.firmName } : undefined;
  const agentId = vis.seeAll ? undefined : session.user.id;
  const isDirector = session.user.role === "director";

  // Three-way filter priority: hubFilter → monthFilter → statusFilter.
  // Only the highest-priority filter that resolves is used.
  const hubFilter   = isHubFilter(filter) ? filter : null;
  const monthFilter = !hubFilter ? parseMonthFilter(exchanging) : null;
  const statusFilter: TransactionStatus | "all" = (!hubFilter && !monthFilter)
    ? ((filter as TransactionStatus | "all") ?? "active")
    : "active";

  const [allTransactions, counts, forecastMonths] = await Promise.all([
    listTransactions(session.user.agencyId, agentId, opts),
    countTransactionsByStatus(session.user.agencyId, agentId, opts),
    getExchangeForecast(session.user.agencyId, agentId, opts).catch(() => []),
  ]);

  // Fetch IDs from the same DB query as the Hub / month helper so counts match exactly
  let filteredTransactions = allTransactions;
  if (hubFilter) {
    const matchingIds = await getHubFilteredIds(vis, hubFilter);
    const idSet = new Set(matchingIds);
    filteredTransactions = allTransactions.filter((tx) => idSet.has(tx.id));
  } else if (monthFilter) {
    const matchingIds = await getMonthExchangingIds(vis, monthFilter.year, monthFilter.month);
    const idSet = new Set(matchingIds);
    filteredTransactions = allTransactions.filter((tx) => idSet.has(tx.id));
  } else if (statusFilter !== "all") {
    filteredTransactions = allTransactions.filter((tx) => tx.status === statusFilter);
  }

  // Pretty month label for the active-month banner + empty state
  const monthLabel = monthFilter
    ? new Date(monthFilter.year, monthFilter.month, 1)
        .toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  return (
    <>
      {/* Canonical PageHeader — matches hub / transaction-detail / work-queue / dashboard.
       * Bloom decorations dropped per Stage 2 decision A (locked 2026-05-12). */}
      <PageHeader
        title={isDirector ? "All Files" : "My Files"}
        subtitle={isDirector ? "Every file across the agency." : "Files assigned to you."}
      >
        <Link
          href="/agent/transactions/new"
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ textDecoration: "none" }}
        >
          <Plus size={14} weight="bold" />
          New sale
        </Link>
        {/* Added during /agent/dashboard merge (2026-05-12). Canonical label per
            VOICE_GUIDELINES.md translation table — dashboard's old "Send note to
            progressor" is dropped in favour of "Send a note to our team". */}
        <AgentFlagButton transactionId={null} address="general" label="Send a note to our team" />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-5">

        {/* Hub filter indicator — data-first phrasing (Stage 3 voice fix).
         * OLD: "Showing <strong>exchanging this week</strong> (3)" — Rule 1 borderline
         * ("Showing" narrated system state). Now leads with the filter phrase + count. */}
        {hubFilter && (
          <div
            className="tl-filter-banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", flex: 1 }}>
              <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>
                {FILTER_LABELS[hubFilter]}
              </strong>
              <span style={{ color: "var(--agent-text-muted)", marginLeft: 6 }}>
                · {filteredTransactions.length} {filteredTransactions.length === 1 ? "file" : "files"}
              </span>
            </span>
            <Link
              href="/agent/transactions"
              className="agent-link agent-link-muted"
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <X size={11} />
              Clear filter
            </Link>
          </div>
        )}

        {/* Month-filter banner — parallel to hub-filter banner, fires when
         * ?exchanging=YYYY-MM is set. The compact ForecastStrip below still
         * renders (active pill carries .on state) — banner is the explicit
         * state confirmation + escape hatch. */}
        {monthFilter && (
          <div
            className="tl-filter-banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", flex: 1 }}>
              <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>
                Exchanging in {monthLabel}
              </strong>
              <span style={{ color: "var(--agent-text-muted)", marginLeft: 6 }}>
                · {filteredTransactions.length} {filteredTransactions.length === 1 ? "file" : "files"}
              </span>
            </span>
            <Link
              href="/agent/transactions"
              className="agent-link agent-link-muted"
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <X size={11} />
              Clear filter
            </Link>
          </div>
        )}

        {allTransactions.length === 0 ? (
          <div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
            <HouseLine
              weight="regular"
              style={{
                width: 32,
                height: 32,
                color: "var(--agent-text-muted)",
                margin: "0 auto 16px",
                display: "block",
                opacity: 0.45,
              }}
            />
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--agent-text-primary)",
              }}
            >
              Create your first sale
            </p>
            {/* OLD: "Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange." — Rule 1 (system-narration "you'll see it here") */}
            <p
              style={{
                margin: "0 auto 24px",
                fontSize: 13,
                color: "var(--agent-text-muted)",
                maxWidth: 340,
                lineHeight: 1.5,
              }}
            >
              Sales appear here once you submit one. Track milestones, manage chases,
              and progress to exchange.
            </p>
            <Link
              href="/agent/transactions/new"
              className="agent-btn agent-btn-primary agent-btn-md"
              style={{ textDecoration: "none" }}
            >
              <Plus size={16} weight="bold" />
              New sale
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Exchange forecast — compact month-pill strip. Refactored
             * 2026-05-12 from tall card to single-row filter affordance.
             * Hidden when hub filter is active (banner replaces forecast in
             * narrowed contexts). When monthFilter is active the strip stays
             * visible and the matching pill renders with .on state. */}
            {!hubFilter && forecastMonths.length > 0 && (
              <ForecastStrip
                months={forecastMonths}
                basePath="/agent/transactions"
                activeMonthKey={monthFilter?.key ?? null}
              />
            )}

            {/* Status tabs — hidden when any filter (hub or month) is active.
             * agent-segment-pill-sm canonical hover/focus/active states;
             * <Link> preserved for server-side URL routing. "On Hold" → "On hold"
             * Stage 3 voice fix applied. */}
            {!hubFilter && !monthFilter && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", overflowX: "auto" }}>
                {(
                  [
                    { value: "all", label: "All", count: allTransactions.length },
                    { value: "active", label: "Active", count: counts.active },
                    // OLD: label: "On Hold" — Stage 3 voice fix: sentence case throughout
                    { value: "on_hold", label: "On hold", count: counts.on_hold },
                    { value: "completed", label: "Completed", count: counts.completed },
                    { value: "withdrawn", label: "Withdrawn", count: counts.withdrawn },
                  ] as { value: string; label: string; count: number }[]
                ).map(({ value, label, count }) => {
                  const isActive = statusFilter === value;
                  return (
                    <Link
                      key={value}
                      href={
                        value === "active"
                          ? "/agent/transactions"
                          : `/agent/transactions?filter=${value}`
                      }
                      scroll={false}
                      className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
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
            )}

            {filteredTransactions.length === 0 ? (
              <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                {hubFilter ? (
                  <EmptyState
                    title={FILTER_EMPTY[hubFilter].title}
                    description={FILTER_EMPTY[hubFilter].description}
                    action={
                      <Link
                        href="/agent/transactions"
                        className="agent-link"
                        style={{ fontSize: 13 }}
                      >
                        View all files
                      </Link>
                    }
                  />
                ) : monthFilter ? (
                  /* Third empty-state branch — fires on stale bookmarked URL or
                   * manually constructed ?exchanging= param. Banner above still
                   * carries the × Clear filter affordance; this empty state
                   * matches the hub-filter pattern so the user sees their filter
                   * is active and can clear it explicitly. */
                  <EmptyState
                    title={`No files exchanging in ${monthLabel}`}
                    description="Files appear here when their expected exchange date falls within this month."
                    action={
                      <Link
                        href="/agent/transactions"
                        className="agent-link"
                        style={{ fontSize: 13 }}
                      >
                        View all files
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState
                    /* statusFilter "on_hold" → "on-hold" (hyphen, not space) per
                       Stage 3 voice review — sentence case + canonical hyphenation. */
                    title={`No ${statusFilter.replace("_", "-")} files`}
                    description="Try a different filter."
                    action={
                      <Link
                        href="/agent/transactions"
                        className="agent-link"
                        style={{ fontSize: 13 }}
                      >
                        View all
                      </Link>
                    }
                  />
                )}
              </div>
            ) : (
              <TransactionListWithSearch
                transactions={filteredTransactions}
                basePath="/agent/transactions"
                isDirector={isDirector}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

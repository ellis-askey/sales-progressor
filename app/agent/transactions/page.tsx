import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { getAccessScope } from "@/lib/security/access-scope";
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

  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isAdminPowers = hasAdminPowers(session);
  const txScope = isInternalStaff ? getAccessScope(session) : null;

  // Internal staff use resolveInternalVisibility (for hub-filtered ID queries).
  // Agent callers use the original resolver unchanged.
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdminPowers)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const opts = !isInternalStaff && vis.seeAll ? { allAgentFiles: true, firmName: vis.firmName } : undefined;
  const agentId = !isInternalStaff && !vis.seeAll ? session.user.id : undefined;
  const isDirector = session.user.role === "director";
  const isProgressor = session.user.role === "sales_progressor";
  // Hide "ASSIGNED TO" for roles that only ever see their own files — the column would always show
  // their own name, which is redundant. Directors and internal staff see files belonging to multiple
  // people, so the column is meaningful for them.
  const showAssignedToColumn = session.user.role !== "negotiator" && session.user.role !== "sales_progressor";

  // Three-way filter priority: hubFilter → monthFilter → statusFilter.
  // Only the highest-priority filter that resolves is used.
  const hubFilter   = isHubFilter(filter) ? filter : null;
  const monthFilter = !hubFilter ? parseMonthFilter(exchanging) : null;
  const statusFilter: TransactionStatus | "all" = (!hubFilter && !monthFilter)
    ? ((filter as TransactionStatus | "all") ?? "active")
    : "active";

  const [allTransactions, counts, forecastMonths] = await Promise.all([
    listTransactions(session.user.agencyId, agentId, opts, txScope ?? undefined),
    countTransactionsByStatus(session.user.agencyId, agentId, opts, txScope ?? undefined),
    getExchangeForecast(session.user.agencyId, agentId, opts, txScope ?? undefined).catch(() => []),
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
        title={isDirector || isAdminPowers ? "All Files" : "My Files"}
        subtitle={
          isAdminPowers                      ? "Every file across every agency." :
          isDirector                         ? "Every file across the agency." :
          session.user.role === "sales_progressor" ? "Files assigned to you." :
          "Files assigned to you."
        }
      >
        {/* "New sale" — available to agents and admin; hidden for sales_progressor */}
        {session.user.role !== "sales_progressor" && session.user.role !== "viewer" && (
          <Link
            href="/agent/transactions/new-v2"
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ textDecoration: "none" }}
          >
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
        {/* AgentFlagButton — agent-only (internal staff don't flag to themselves) */}
        {!isInternalStaff && (
          <AgentFlagButton transactionId={null} address="general" label="Send a note to our team" />
        )}
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
            {isProgressor ? (
              <>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                  No files assigned yet
                </p>
                <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 300, lineHeight: 1.5 }}>
                  Files assigned to you will appear here.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                  Create your first sale
                </p>
                {/* OLD: "Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange." — Rule 1 (system-narration "you'll see it here") */}
                <p style={{ margin: "0 auto 24px", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                  Sales appear here once you submit one. Track steps, manage chases,
                  and progress to exchange.
                </p>
                <Link
                  href="/agent/transactions/new-v2"
                  className="agent-btn agent-btn-primary agent-btn-md"
                  style={{ textDecoration: "none" }}
                >
                  <Plus size={16} weight="bold" />
                  New sale
                </Link>
              </>
            )}
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

            {/* Status tabs moved into TransactionListWithSearch's hanging-basket
             * bar (2026-05-12) — status tabs (LEFT) + filter chips (RIGHT) now
             * share a single surface mirroring PropertyFileTabs visual pattern. */}

            {filteredTransactions.length === 0 ? (
              <div className="agent-glass-strong agent-empty-card" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
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
                statusFilter={statusFilter}
                statusCounts={{
                  all: allTransactions.length,
                  active: counts.active,
                  on_hold: counts.on_hold,
                  completed: counts.completed,
                  withdrawn: counts.withdrawn,
                }}
                showStatusTabs={!hubFilter && !monthFilter}
                showAgencyColumn={isInternalStaff}
                showAssignedToColumn={showAssignedToColumn}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

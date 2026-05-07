import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility } from "@/lib/services/agent";
import { listTransactions, countTransactionsByStatus } from "@/lib/services/transactions";
import { getHubFilteredIds, type HubFilter } from "@/lib/services/hub";
import { TransactionListWithSearch } from "@/components/transactions/TransactionListWithSearch";
import { EmptyState } from "@/components/ui/EmptyState";
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
] as const;

function isHubFilter(v: string | undefined): v is HubFilter {
  return HUB_FILTER_VALUES.includes(v as HubFilter);
}

const FILTER_LABELS: Record<HubFilter, string> = {
  "exchanging-this-week": "Exchanging this week",
  "completing-this-week": "Completing this week",
  "closing-this-month": "Closing this month",
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
};

export default async function AllTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireSession();
  const { filter } = await searchParams;

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const opts = vis.seeAll ? { allAgentFiles: true, firmName: vis.firmName } : undefined;
  const agentId = vis.seeAll ? undefined : session.user.id;
  const isDirector = session.user.role === "director";

  const hubFilter = isHubFilter(filter) ? filter : null;
  // Status filter — only relevant when no hub filter is active
  const statusFilter: TransactionStatus | "all" = !hubFilter
    ? ((filter as TransactionStatus | "all") ?? "active")
    : "active";

  const [allTransactions, counts] = await Promise.all([
    listTransactions(session.user.agencyId, agentId, opts),
    countTransactionsByStatus(session.user.agencyId, agentId, opts),
  ]);

  // Fetch IDs from the same DB query as the Hub so counts match exactly
  let filteredTransactions = allTransactions;
  if (hubFilter) {
    const matchingIds = await getHubFilteredIds(vis, hubFilter);
    const idSet = new Set(matchingIds);
    filteredTransactions = allTransactions.filter((tx) => idSet.has(tx.id));
  } else if (statusFilter !== "all") {
    filteredTransactions = allTransactions.filter((tx) => tx.status === statusFilter);
  }

  return (
    <>
      {/* Glass header */}
      <div
        style={{
          background: "rgba(255,255,255,0.52)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderBottom: "0.5px solid rgba(255,255,255,0.70)",
          boxShadow:
            "0 4px 24px rgba(var(--agent-coral-base-rgb),0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Coral bloom — top right */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -60,
            right: -40,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(var(--agent-coral-base-rgb),0.13) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Warm bloom — bottom left */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -40,
            left: 60,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(var(--agent-bloom-gold-rgb),0.10) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative px-4 pt-6 pb-7 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "var(--agent-text-h1)",
                  fontWeight: "var(--agent-weight-semibold)",
                  color: "var(--agent-text-primary)",
                  letterSpacing: "var(--agent-tracking-tight)",
                  lineHeight: "var(--agent-line-tight)",
                }}
              >
                {isDirector ? "All Files" : "My Files"}
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Link
                href="/agent/transactions/new"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none" }}
              >
                <Plus size={16} weight="bold" />
                New sale
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7 space-y-5">

        {/* Hub filter indicator */}
        {hubFilter && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(var(--agent-coral-base-rgb), 0.07)",
              border: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.18)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", flex: 1 }}>
              Showing{" "}
              <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>
                {FILTER_LABELS[hubFilter].toLowerCase()}
              </strong>{" "}
              <span style={{ color: "var(--agent-text-muted)" }}>
                ({filteredTransactions.length})
              </span>
            </span>
            <Link
              href="/agent/transactions"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 500,
                color: "var(--agent-text-secondary)",
                textDecoration: "none",
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.55)",
                border: "0.5px solid rgba(0,0,0,0.08)",
              }}
            >
              <X size={11} />
              Clear filter
            </Link>
          </div>
        )}

        {allTransactions.length === 0 ? (
          <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
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
            <p
              style={{
                margin: "0 auto 24px",
                fontSize: 13,
                color: "var(--agent-text-muted)",
                maxWidth: 340,
                lineHeight: 1.5,
              }}
            >
              Once you submit a sale, you&apos;ll see it here. Track milestones, manage chases,
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
          <div>
            {/* Status tabs — hidden when a hub filter is active */}
            {!hubFilter && (
              <div className="flex items-center gap-1 mb-5 glass-subtle p-1 w-full md:w-fit overflow-x-auto">
                {(
                  [
                    { value: "all", label: "All", count: allTransactions.length },
                    { value: "active", label: "Active", count: counts.active },
                    { value: "on_hold", label: "On Hold", count: counts.on_hold },
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
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/60 text-slate-900/90 shadow-sm"
                          : "text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20"
                      }`}
                    >
                      {label}
                      <span
                        className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                          isActive
                            ? "bg-blue-50/80 text-blue-600"
                            : "bg-white/30 text-slate-900/50"
                        }`}
                      >
                        {count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {filteredTransactions.length === 0 ? (
              <div className="glass-card">
                {hubFilter ? (
                  <EmptyState
                    title={FILTER_EMPTY[hubFilter].title}
                    description={FILTER_EMPTY[hubFilter].description}
                    action={
                      <Link
                        href="/agent/transactions"
                        className="text-sm agent-link-primary"
                      >
                        View all files
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState
                    title={`No ${statusFilter.replace("_", " ")} files`}
                    description="Try a different filter."
                    action={
                      <Link
                        href="/agent/transactions"
                        className="text-sm agent-link-primary"
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

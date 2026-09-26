import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { getAccessScope } from "@/lib/security/access-scope";
import { listTransactions } from "@/lib/services/transactions";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getHubFilteredIds, getMonthExchangingIds, getGoneQuietFiles, type HubFilter } from "@/lib/services/hub";
import { getWorkQueueItems } from "@/lib/services/work-queue";
import { FilesWorkspace } from "@/components/transactions/FilesWorkspace";
import { getPipelineStageMap } from "@/lib/services/pipeline";
import { AllFilesEmptyState } from "@/components/transactions/AllFilesEmptyState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";
import { agencyHasActiveOutsourcedFile } from "@/lib/agent/outsourcing";
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
  // "Send a note to our team" only routes somewhere if the agency has a file with
  // our team. Hide it for self-managed-only agencies (it would file to nobody).
  const hasOutsourced = await agencyHasActiveOutsourcedFile(session.user.agencyId);
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

  // The exchange forecast is now a view inside the workspace (built from the
  // rows themselves), so this page no longer fetches getExchangeForecast or
  // renders the standalone month strip — both still live for the dashboard.
  const allTransactions = await listTransactions(session.user.agencyId, agentId, opts, txScope ?? undefined);

  // Hub / month views narrow to a server-computed subset. The status tabs, by
  // contrast, now filter CLIENT-side (instant) — so in status mode we hand the
  // client every file and let it slice by tab with no server round-trip. This
  // is what makes tab switching immediate; previously every tab click re-ran
  // this whole page (re-list every file, recompute health, re-sign photos).
  const inNarrowedMode = !!(hubFilter || monthFilter);
  let narrowedSubset = allTransactions;
  if (hubFilter) {
    const idSet = new Set(await getHubFilteredIds(vis, hubFilter));
    narrowedSubset = allTransactions.filter((tx) => idSet.has(tx.id));
  } else if (monthFilter) {
    const idSet = new Set(await getMonthExchangingIds(vis, monthFilter.year, monthFilter.month));
    narrowedSubset = allTransactions.filter((tx) => idSet.has(tx.id));
  }

  const clientTransactions = inNarrowedMode ? narrowedSubset : allTransactions;

  // Sign photos, resolve each active file's pipeline stage, and gather the
  // segment id-sets whose data isn't on the row (gone-quiet + work-queue
  // alerts) in one parallel pass. The segment sets are skipped in narrowed
  // mode, where the strip + segments don't render. getGoneQuietFiles /
  // getWorkQueueItems are the canonical detectors — imported, not re-derived.
  const [photoMap, stageMap, quietFiles, workQueue] = await Promise.all([
    getSignedUrlMap(clientTransactions.map((t) => t.photoStoragePath)),
    getPipelineStageMap(clientTransactions.filter((t) => t.status === "active").map((t) => t.id)),
    inNarrowedMode ? Promise.resolve([]) : getGoneQuietFiles(vis).catch(() => []),
    inNarrowedMode ? Promise.resolve([]) : getWorkQueueItems(vis).catch(() => []),
  ]);
  const rowsWithPhotos = clientTransactions.map((t) => ({
    ...t,
    photoUrl: t.photoStoragePath ? photoMap.get(t.photoStoragePath) ?? null : null,
  }));
  const stageByTx = Object.fromEntries(stageMap);

  const goneQuietIds = quietFiles.map((q) => q.transactionId);
  const noSolicitorIds = workQueue
    .filter((i) => i.alerts.includes("missing_vendor_solicitor") || i.alerts.includes("missing_purchaser_solicitor"))
    .map((i) => i.id);
  const stalledIds = workQueue.filter((i) => i.alerts.includes("stale")).map((i) => i.id);

  // Current calendar month, for the strip's "Exchanging <month>" tile + link.
  const nowDate = new Date();
  const monthKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;

  // Agency monthly fees target (drives the Forecast "ahead / short" line).
  // Agency-scoped, so internal staff (agencyId null) get none. Wrapped so the
  // page still loads if the additive column hasn't been migrated yet (the
  // feature simply stays dormant until it lands).
  let monthlyTargetPence: number | null = null;
  if (session.user.agencyId) {
    try {
      const agencyTarget = await prisma.agency.findUnique({
        where: { id: session.user.agencyId },
        select: { monthlyFeeTargetPence: true },
      });
      monthlyTargetPence = agencyTarget?.monthlyFeeTargetPence ?? null;
    } catch {
      monthlyTargetPence = null;
    }
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
            href="/agent/transactions/new"
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ textDecoration: "none" }}
          >
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        )}
        {/* AgentFlagButton — agent-only, and only when there's a team to receive
            it (an active outsourced sale). */}
        {!isInternalStaff && hasOutsourced && (
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
                · {narrowedSubset.length} {narrowedSubset.length === 1 ? "file" : "files"}
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
         * ?exchanging=YYYY-MM is set (reached from the Forecast view or the
         * portfolio strip's "Exchanging" tile). The banner is the explicit
         * state confirmation + escape hatch back to the full book. */}
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
                · {narrowedSubset.length} {narrowedSubset.length === 1 ? "file" : "files"}
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
          !isInternalStaff ? (
            // Agency users with no files: the onboarding empty state (mock).
            <AllFilesEmptyState />
          ) : (
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
                  href="/agent/transactions/new"
                  className="agent-btn agent-btn-primary agent-btn-md"
                  style={{ textDecoration: "none" }}
                >
                  <Plus size={16} weight="bold" />
                  New sale
                </Link>
              </>
            )}
          </div>
          )
        ) : (
          <div className="space-y-5">
            {/* The exchange forecast lives inside the workspace now (its own
             * view tab), replacing the standalone month-pill strip. The month
             * filter (?exchanging=YYYY-MM) is still reachable from the Forecast
             * view and the portfolio strip's "Exchanging" tile. */}

            {/* Status tabs moved into TransactionListWithSearch's hanging-basket
             * bar (2026-05-12) — status tabs (LEFT) + filter chips (RIGHT) now
             * share a single surface mirroring PropertyFileTabs visual pattern. */}

            {inNarrowedMode && narrowedSubset.length === 0 ? (
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
                ) : (
                  /* Month-filter empty — fires on a stale bookmarked URL or a
                   * manually constructed ?exchanging= param. Banner above carries
                   * the × Clear filter affordance. */
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
                )}
              </div>
            ) : (
              /* Status mode hands the client EVERY file; it slices by tab
               * client-side (instant) and renders its own per-status empty
               * state. Narrowed mode passes the subset with tabs hidden. */
              <FilesWorkspace
                transactions={rowsWithPhotos}
                stageByTx={stageByTx}
                basePath="/agent/transactions"
                isDirector={isDirector}
                initialStatus={inNarrowedMode ? "all" : statusFilter}
                showStatusTabs={!inNarrowedMode}
                showAgencyColumn={isInternalStaff}
                showAssignedToColumn={showAssignedToColumn}
                showViewSwitcher={!inNarrowedMode}
                currentUserId={session.user.id}
                goneQuietIds={goneQuietIds}
                noSolicitorIds={noSolicitorIds}
                stalledIds={stalledIds}
                monthKey={monthKey}
                monthlyTargetPence={monthlyTargetPence}
                streetViewKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Perceived-performance (2026-09-18): let the client router reuse this
// page for 5 minutes after a visit — moving around a working burst never
// re-renders a page you just saw. Per-page opt-in rather than a global
// staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Every mutation still purges this via its
// revalidatePath calls, and the "As of" button force-refreshes.
export const unstable_dynamicStaleTime = 300;

// Agent file-detail page.
//
// 2026-06-03 perf refactor — Lever B from the staging timing investigation.
// The page server component used to await ~21 queries before returning
// any JSX, so the skeleton.tsx fallback sat on screen for 3-5 seconds
// while everything fanned out. Profiling showed the residual cost was
// connection-pool contention, not any single slow query: removing one
// just made the others cluster at the same time.
//
// New shape:
//   - The page awaits ONLY the bare minimum needed to render the shell:
//     transaction, milestones (for hero progress + sidebar progress +
//     shared by panels via React.cache), and the agent-user lookup for
//     the hero's assignedUserName fallback.
//   - Every tab body is now an async server component (StepsPanel,
//     RemindersPanel, ToDoPanel, ActivityPanel, OverviewPanel) mounted
//     under <Suspense>. Each does its own fetch using cached fetchers,
//     so shared data (milestones, reminderLogs) is deduped per request.
//   - The sidebar is similarly a Suspense'd SidebarPanel.
//   - Top-of-page banners that need their own data (ClaimWelcomeModal,
//     ReconcileLaterBanner) live in tiny async wrappers.
//
// User-perceived result: header + tabs row + skeletons paint as soon as
// the critical-path fan-out resolves; tab content streams in over the
// next moment without holding the skeleton open.

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  getTransactionCached,
  getTransactionByScopeCached,
  getMilestonesCached,
} from "@/lib/services/cached-fetchers";
import { calculateProgress, computeEffectiveStartDate, detectPhase } from "@/lib/services/fees";
import { totalHoldMs } from "@/lib/services/hold-duration";

import { PropertyHero } from "@/components/transaction/PropertyHero";
import { PropertyFileTabs } from "@/components/transaction/PropertyFileTabs";
import { PortalConfirmEmailToggle } from "@/components/transaction/PortalConfirmEmailToggle";
import { AiSummaryButton } from "@/components/transaction/AiSummaryButton";
import { MosConfirmedNotice } from "@/components/transaction/MosConfirmedNotice";
import { RemindersReadyNotice } from "@/components/transaction/RemindersReadyNotice";
import { ClaimedToast } from "@/components/transaction/ClaimedToast";
import { ChainSetupFailedBanner } from "@/components/transaction/ChainSetupFailedBanner";
import { OnHoldBanner } from "@/components/transaction/OnHoldBanner";
import { RelistBanner } from "@/components/transaction/RelistBanner";
import { RoundChip } from "@/components/transaction/RoundChip";
import { TransactionViewTracker } from "@/components/agent/TransactionViewTracker";
import { FileTimeTracker } from "@/components/transaction/FileTimeTracker";
import { PerfOverlay } from "@/components/debug/PerfOverlay";

import { SidebarPanel } from "@/components/transaction/SidebarPanel";
import { OverviewPanel } from "@/components/transaction/OverviewPanel";
import { StepsPanel } from "@/components/transaction/StepsPanel";
import { RemindersPanel } from "@/components/transaction/RemindersPanel";
import { ToDoPanel } from "@/components/transaction/ToDoPanel";
import { ActivityPanel } from "@/components/transaction/ActivityPanel";
import { ClaimWelcomeAsync } from "@/components/transaction/ClaimWelcomeAsync";
import { ReconcileLaterAsync } from "@/components/transaction/ReconcileLaterAsync";
import { SidebarPanelSkeleton, TabPanelSkeleton } from "@/components/transaction/PanelSkeletons";
import { RevealCoordinator, RevealSlot, RevealPing } from "@/components/transaction/RevealCoordinator";
import { ReassignOwnerControl } from "@/components/transaction/ReassignOwnerControl";
import { listAssignableAgentsForAgency } from "@/lib/services/agency-team";

// Per-query timing helper for the perf-investigation overlay (?perf=1).
type Timing = { label: string; ms: number };
function timed<T>(label: string, p: Promise<T>, into: Timing[]): Promise<T> {
  const start = performance.now();
  return p.then((r) => {
    into.push({ label, ms: Math.round(performance.now() - start) });
    return r;
  });
}

export default async function AgentTransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; chainSetupFailed?: string; newUser?: string; perf?: string }>;
}) {
  const perfStart = performance.now();
  const perfTimings: Timing[] = [];
  const [{ id }, { tab: initialTab, perf: perfFlag }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  const perfEnabled = perfFlag === "1";

  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdminRole  = hasAdminPowers(session);
  const txScope = isInternalStaff ? getAccessScope(session) : null;

  // ── Critical-path fan-out ─────────────────────────────────────────────
  // Three queries fired in parallel:
  //   - the file itself (transaction + canonical includes)
  //   - milestones (slowest single query; needed for hero progress and
  //     re-used by every panel via React.cache)
  //   - agent user (small ID lookup; fallback for the hero's
  //     "assignedUserName" badge when no SP is assigned)
  // First paint waits on max(slowest of three). Everything else fans
  // out from inside the Suspense'd panels.
  const stage1Start = performance.now();
  const [transaction, milestoneData] = await Promise.all([
    timed("s1:transaction",
      isInternalStaff
        ? getTransactionByScopeCached(id, txScope!)
        : getTransactionCached(id, session.user.agencyId),
      perfTimings),
    timed("s1:milestones",
      getMilestonesCached(id, session.user.agencyId).catch(() => null),
      perfTimings),
  ]);
  const stage1ElapsedMs = Math.round(performance.now() - stage1Start);

  if (!transaction) notFound();
  const isDirectorRole = session.user.role === "director";
  const isAgentRole = isDirectorRole || session.user.role === "negotiator";
  // Agent ownership check: director sees all; negotiator only sees their own files.
  // Internal staff bypass: getTransactionByScope already enforces access scope above.
  if (!isInternalStaff && !isDirectorRole && transaction.agentUserId !== session.user.id) notFound();

  // Agent user lookup — small ID query for the hero's assignedUserName fallback.
  const agentUser = transaction.agentUserId
    ? await timed("s1:agentUser",
        prisma.user.findUnique({
          where: { id: transaction.agentUserId },
          select: { id: true, name: true, email: true, firmName: true },
        }),
        perfTimings)
    : null;

  // SP/admin sender identity for the ActivityPanel ComposeEmail. We
  // resolve this in the page so the panel doesn't have to re-derive
  // the role flags; the chain (verifiedDomain → userVerifiedEmail) is
  // still small enough to sit on the critical path.
  let spSenderIdentity: { name: string; email: string } | undefined;
  if (isInternalStaff && (isProgressor || isAdminRole)) {
    const agencyId = transaction.agencyId;
    if (agencyId) {
      const domain = await prisma.verifiedDomain.findFirst({
        where: { agencyId, status: "verified" },
        select: { id: true },
      });
      const userEmail = domain
        ? await prisma.userVerifiedEmail.findFirst({
            where: {
              userId: session.user.id,
              verifiedDomainId: domain.id,
              status: { in: ["verified", "legacy_single_sender"] },
            },
            select: { email: true },
          })
        : null;
      spSenderIdentity = userEmail
        ? { name: session.user.name!, email: userEmail.email }
        : { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
    } else {
      spSenderIdentity = { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
    }
  }

  // ── Hero-level progress (derived from the critical-path milestones) ───
  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];
  const completedMilestoneCodes = allMilestones.filter((m) => m.isComplete).map((m) => m.code);
  const allCompletions = allMilestones
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
  const effectiveStartDate = computeEffectiveStartDate(transaction.createdAt, allCompletions);
  const holdInput = { status: transaction.status, holdPeriods: transaction.holdPeriods };
  const progress = calculateProgress(
    (milestoneData?.vendor ?? []).map((m) => ({ weight: Number(m.weight), isComplete: m.isComplete, isNotRequired: m.isNotRequired })),
    (milestoneData?.purchaser ?? []).map((m) => ({ weight: Number(m.weight), isComplete: m.isComplete, isNotRequired: m.isNotRequired })),
    transaction.createdAt,
    transaction.overridePredictedDate ?? null,
    milestoneData ? {
      completedMilestoneCodes,
      purchaseType: transaction.purchaseType ?? null,
      tenure: transaction.tenure ?? null,
      isShareOfFreehold: transaction.isShareOfFreehold,
      effectiveStartDate,
    } : undefined,
    { status: transaction.status, holdMs: totalHoldMs(holdInput) },
  );
  if (milestoneData) {
    progress.fileLevelPhase = detectPhase(new Set(completedMilestoneCodes)).fileLevelPhase;
  }

  const assignedDisplayName =
    (transaction.assignedUser as { name?: string | null } | null)?.name ??
    agentUser?.name ??
    null;

  // Tab strip — badges (counts on Reminders + To-Do) update via
  // TabBadgeReporter once the relevant panels stream in.
  const tabs = [
    { key: "overview",   label: "Overview" },
    { key: "milestones", label: "Steps" },
    { key: "reminders",  label: "Reminders", badge: 0 },
    { key: "todos",      label: "To-Do", badge: 0 },
    { key: "activity",   label: "Activity" },
  ];

  // Director-only reassign picker data. Only fetched when the viewer is a
  // director AND the file is self-managed (outsourced files have a
  // progressor assigned through a different flow and the director doesn't
  // own the assignment there). The "1 or fewer agents" branch returns
  // an empty list so the picker silently hides.
  const showReassign = isDirectorRole && transaction.serviceType === "self_managed";
  const assignableAgents = showReassign && session.user.agencyId
    ? await listAssignableAgentsForAgency(session.user.agencyId).catch(() => [])
    : [];

  const totalServerMs = Math.round(performance.now() - perfStart);

  const sidebar = (
    <RevealSlot skeleton={<SidebarPanelSkeleton />}>
      <Suspense fallback={null}>
        <SidebarPanel
          transaction={{
            id: transaction.id,
            propertyAddress: transaction.propertyAddress,
            purchasePrice: transaction.purchasePrice ?? null,
            tenure: transaction.tenure ?? null,
            purchaseType: transaction.purchaseType ?? null,
            isShareOfFreehold: transaction.isShareOfFreehold,
            status: transaction.status,
            chainLinkId: transaction.chainLinkId ?? null,
            overridePredictedDate: transaction.overridePredictedDate ?? null,
            completionDate: transaction.completionDate ?? null,
            createdAt: transaction.createdAt,
            serviceType: transaction.serviceType ?? null,
            freeOnExchange: transaction.freeOnExchange ?? null,
            agentFeeAmount: transaction.agentFeeAmount ?? null,
            agentFeePercent: transaction.agentFeePercent ? Number(transaction.agentFeePercent) : null,
            agentFeeIsVatInclusive: transaction.agentFeeIsVatInclusive ?? null,
            referralFee: transaction.referralFee ?? null,
            referredFirmId: transaction.referredFirmId ?? null,
            referredFirm: transaction.referredFirm ?? null,
            agentUserId: transaction.agentUserId ?? null,
            assignedUserId: transaction.assignedUserId ?? null,
            agencyId: transaction.agencyId,
            agency: transaction.agency ? { feeTier: transaction.agency.feeTier, legacyOutsourcedFeePence: transaction.agency.legacyOutsourcedFeePence } : null,
            holdPeriods: transaction.holdPeriods,
          }}
          isInternalStaff={isInternalStaff}
          isInternal={isInternalStaff}
          isDirectorRole={isDirectorRole}
          isProgressor={isProgressor}
          isAdminRole={isAdminRole}
          isAgentRole={isAgentRole}
          agencyId={session.user.agencyId}
          agentSlot={
            showReassign && assignableAgents.length > 1 ? (
              <ReassignOwnerControl
                transactionId={transaction.id}
                currentAgentUserId={transaction.agentUserId ?? null}
                currentAgentName={assignedDisplayName}
                currentUserId={session.user.id}
                assignableAgents={assignableAgents}
              />
            ) : undefined
          }
        />
        <RevealPing slotId="sidebar" />
      </Suspense>
    </RevealSlot>
  );

  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8">
      {perfEnabled && (
        <PerfOverlay
          serverTimings={perfTimings}
          stage1ElapsedMs={stage1ElapsedMs}
          stage2ElapsedMs={0}
          totalServerMs={totalServerMs}
          renderedAtIso={new Date().toISOString()}
        />
      )}
      <TransactionViewTracker transactionId={id} propertyAddress={transaction.propertyAddress} userId={session.user.id} />
      <FileTimeTracker transactionId={id} isOnHold={transaction.status === "on_hold"} />
      <Suspense><MosConfirmedNotice /></Suspense>
      <Suspense><RemindersReadyNotice transactionId={id} /></Suspense>
      <Suspense><ClaimedToast address={transaction.propertyAddress} /></Suspense>
      <ClaimWelcomeAsync address={transaction.propertyAddress} chainLinkId={transaction.chainLinkId ?? null} />
      <Suspense><ChainSetupFailedBanner /></Suspense>
      <OnHoldBanner show={transaction.status === "on_hold"} />
      <RelistBanner
        show={transaction.status === "withdrawn" && transaction.exchangedAt === null}
        transactionId={transaction.id}
        previousPurchasePrice={transaction.purchasePrice}
      />
      <ReconcileLaterAsync
        transactionId={id}
        chainLinkId={transaction.chainLinkId ?? null}
        tenure={transaction.tenure ?? null}
        purchaseType={transaction.purchaseType ?? null}
      />
      <PropertyHero
        address={transaction.propertyAddress}
        agencyName={transaction.agency.name}
        status={transaction.status}
        tenure={transaction.tenure ?? null}
        purchaseType={transaction.purchaseType ?? null}
        purchasePrice={transaction.purchasePrice ?? null}
        exchangeDate={transaction.expectedExchangeDate ?? null}
        percent={progress.percent}
        onTrack={progress.onTrack}
        serviceType={transaction.serviceType}
        hideServiceTypeBadge={false}
        backHref="/agent/transactions"
        assignedUserName={assignedDisplayName}
        createdAt={transaction.createdAt}
        transactionId={transaction.id}
        inChain={!!transaction.chainLinkId}
        isAdminViewer={isAdminRole}
        roundChipSlot={
          <RoundChip
            transactionId={transaction.id}
            status={transaction.status}
            activeRoundNumber={transaction.activeBuyerRound?.roundNumber ?? null}
            activeBuyerName={
              transaction.contacts.find(
                (c) => c.roleType === "purchaser",
              )?.name ?? null
            }
            buyerRounds={transaction.buyerRounds ?? []}
          />
        }
      />

      <RevealCoordinator slots={["sidebar", "overview"]}>
      <PropertyFileTabs
        tabs={tabs}
        sidebar={sidebar}
        initialTab={initialTab}
        heroConnected
        rightSlot={
          (() => {
            const internal =
              session.user.role === "sales_progressor" ||
              session.user.role === "admin" ||
              session.user.role === "superadmin";
            const isEllis = session.user.email === "ellis@thesalesprogressor.co.uk";
            if (!internal && !isEllis) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isEllis && <AiSummaryButton transactionId={transaction.id} />}
                {internal && (
                  <PortalConfirmEmailToggle
                    transactionId={transaction.id}
                    initialValue={transaction.suppressPortalConfirmEmails}
                    pathname={`/agent/transactions/${transaction.id}`}
                  />
                )}
              </div>
            );
          })()
        }
      >
        {/* Tab 0: Overview */}
        <RevealSlot skeleton={<TabPanelSkeleton rows={6} withHero />}>
          <Suspense fallback={null}>
            <OverviewPanel
              transaction={transaction}
              agencyId={session.user.agencyId}
              isInternalStaff={isInternalStaff}
              isDirectorRole={isDirectorRole}
              currentUserId={session.user.id}
              currentUserName={session.user.name ?? ""}
              recommendedFirms={null}
            />
            <RevealPing slotId="overview" />
          </Suspense>
        </RevealSlot>

        {/* Tab 1: Steps */}
        <Suspense fallback={<TabPanelSkeleton rows={8} />}>
          <StepsPanel
            transactionId={transaction.id}
            agencyId={session.user.agencyId}
            purchaseType={transaction.purchaseType ?? null}
          />
        </Suspense>

        {/* Tab 2: Reminders */}
        <Suspense fallback={<TabPanelSkeleton rows={4} />}>
          <RemindersPanel
            transactionId={transaction.id}
            agencyId={session.user.agencyId}
            propertyAddress={transaction.propertyAddress}
            transactionStatus={transaction.status}
            contacts={transaction.contacts}
          />
        </Suspense>

        {/* Tab 3: To-Do */}
        <Suspense fallback={<TabPanelSkeleton rows={3} />}>
          <ToDoPanel
            transactionId={transaction.id}
            transactionAddress={transaction.propertyAddress}
            agencyId={session.user.agencyId}
            serviceType={transaction.serviceType ?? null}
            isInternalStaff={isInternalStaff}
            isProgressor={isProgressor}
            isAdminRole={isAdminRole}
          />
        </Suspense>

        {/* Tab 4: Activity */}
        <Suspense fallback={<TabPanelSkeleton rows={6} />}>
          <ActivityPanel
            transactionId={transaction.id}
            agencyId={session.user.agencyId}
            isInternal={isInternalStaff}
            isInternalStaff={isInternalStaff}
            isProgressor={isProgressor}
            isAdminRole={isAdminRole}
            currentUserId={session.user.id}
            currentUserName={session.user.name ?? ""}
            currentUserRole={session.user.role ?? ""}
            spSenderIdentity={spSenderIdentity}
            contacts={transaction.contacts}
            vendorSolicitor={transaction.vendorSolicitorContact ?? null}
            purchaserSolicitor={transaction.purchaserSolicitorContact ?? null}
          />
        </Suspense>
      </PropertyFileTabs>
      </RevealCoordinator>
    </div>
  );
}

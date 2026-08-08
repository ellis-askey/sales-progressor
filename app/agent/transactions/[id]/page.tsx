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
import { MilestoneTimelineStrip, type MilestoneStage } from "@/components/transaction/MilestoneTimelineStrip";
import { resolveDisplayStages } from "@/lib/milestones/display-stages";
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
import { GlassCard } from "@/components/glass/GlassCard";

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

  // 2026-08-08 perf: three post-tx lookups (agentUser, sp-sender-identity
  // chain, director-only assignable agents) used to await one after the
  // other, ~200-300ms total on internal-staff loads. None depend on each
  // other's result, so they run as a single Promise.all — max of the three
  // instead of sum. assignableAgents' fetch is guarded by the same
  // condition it used before so nothing changes for non-director loads.
  const showReassign = isDirectorRole && transaction.serviceType === "self_managed";

  const [agentUser, spSenderIdentityResolved, assignableAgentsResolved, heroPhotoUrl] = await Promise.all([
    // Agent user lookup — small ID query for the hero's assignedUserName fallback.
    transaction.agentUserId
      ? timed("s1:agentUser",
          prisma.user.findUnique({
            where: { id: transaction.agentUserId },
            select: { id: true, name: true, email: true, firmName: true },
          }),
          perfTimings)
      : Promise.resolve(null),

    // SP/admin sender identity for the ActivityPanel ComposeEmail. Two
    // serial DB round-trips (verifiedDomain → userVerifiedEmail) but the
    // whole chain is one branch of this parallel, so it doesn't block the
    // other two lookups.
    (async (): Promise<{ name: string; email: string } | undefined> => {
      if (!isInternalStaff || (!isProgressor && !isAdminRole)) return undefined;
      const agencyId = transaction.agencyId;
      if (!agencyId) return { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
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
      return userEmail
        ? { name: session.user.name!, email: userEmail.email }
        : { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
    })(),

    // Director-only reassign picker data. Only fetched when the viewer is a
    // director AND the file is self-managed. The "1 or fewer agents" branch
    // returns an empty list so the picker silently hides.
    showReassign && session.user.agencyId
      ? listAssignableAgentsForAgency(session.user.agencyId).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof listAssignableAgentsForAgency>>),

    // Hero photo — sign a fresh URL on read (1h expiry) when the file has
    // a property photo, mirroring the portal's pattern. Null on failure
    // so the hero falls back to its gradient + house glyph slot.
    (async (): Promise<string | null> => {
      if (!transaction.photoStoragePath) return null;
      try {
        const { getSignedUrl } = await import("@/lib/supabase-storage");
        return await getSignedUrl(transaction.photoStoragePath, 3600);
      } catch (err) {
        console.warn("[file-detail] failed to sign property-photo URL", err);
        return null;
      }
    })(),
  ]);

  const spSenderIdentity = spSenderIdentityResolved;
  const assignableAgents = assignableAgentsResolved;

  // ── Hero-level progress (derived from the critical-path milestones) ───
  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];
  const completedMilestoneCodes = allMilestones.filter((m) => m.isComplete).map((m) => m.code);
  const allCompletions = allMilestones
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
  // Pass 3b: anchor "weeks elapsed" / "off track" / 12-week target on the
  // active sale's start when present. Relisted file resets to the new
  // sale's createdAt; legacy pre-Phase-1 files (no active round) fall back
  // to tx.createdAt. Mirrors the list-view fix in listTransactions.
  const progressAnchor = transaction.activeBuyerRound?.createdAt ?? transaction.createdAt;
  const effectiveStartDate = computeEffectiveStartDate(progressAnchor, allCompletions);
  const holdInput = { status: transaction.status, holdPeriods: transaction.holdPeriods };
  const progress = calculateProgress(
    (milestoneData?.vendor ?? []).map((m) => ({ weight: Number(m.weight), isComplete: m.isComplete, isNotRequired: m.isNotRequired })),
    (milestoneData?.purchaser ?? []).map((m) => ({ weight: Number(m.weight), isComplete: m.isComplete, isNotRequired: m.isNotRequired })),
    progressAnchor,
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

  // "Managing this file" name in the hero. Rules (locked 2026-08-08):
  //   outsourced  → the assigned progressor (sales_progressor). Null if
  //                 no one is assigned yet — the hero renders "Not
  //                 assigned yet" in that case.
  //   self_managed → the file's own agent (director or negotiator).
  //                 agentUserId always reflects who currently owns the
  //                 file (ReassignOwnerControl updates it on reassign),
  //                 so this covers both "creator" and "reassigned by
  //                 director" cases in one pull.
  // The old logic ("assignedUser || agentUser") showed the customer
  // agency's agent on outsourced files that hadn't been picked up yet,
  // which read as "this agency staff member is managing the file" — the
  // opposite of the truth. Fixed here.
  const assignedDisplayName = transaction.serviceType === "outsourced"
    ? ((transaction.assignedUser as { name?: string | null } | null)?.name ?? null)
    : (agentUser?.name ?? null);

  // Tab strip — badges (counts on Reminders + To-Do) update via
  // TabBadgeReporter once the relevant panels stream in.
  const tabs = [
    { key: "overview",   label: "Overview", icon: "house" },
    { key: "milestones", label: "Steps", icon: "steps" },
    { key: "reminders",  label: "Reminders", badge: 0, icon: "bell" },
    { key: "todos",      label: "To-Do", badge: 0, icon: "todo" },
    { key: "activity",   label: "Activity", icon: "activity" },
  ];

  // Role-gated header controls — 2026-08-08 hero redesign: these moved
  // from the tab bar's rightSlot into the hero's top-right corner (one
  // home per control, no same-screen duplication). Gates unchanged:
  // AI summary is Ellis-only, portal-emails toggle is internal staff.
  const heroTopRightSlot = (() => {
    const internal =
      session.user.role === "sales_progressor" ||
      session.user.role === "admin" ||
      session.user.role === "superadmin";
    const isEllis = session.user.email === "ellis@thesalesprogressor.co.uk";
    if (!internal && !isEllis) return null;
    return (
      <>
        {isEllis && <AiSummaryButton transactionId={transaction.id} />}
        {internal && (
          <PortalConfirmEmailToggle
            transactionId={transaction.id}
            initialValue={transaction.suppressPortalConfirmEmails}
            pathname={`/agent/transactions/${transaction.id}`}
          />
        )}
      </>
    );
  })();

  // (showReassign + assignableAgents resolved above alongside agentUser
  // + spSenderIdentity — see the Promise.all after the critical-path fan-out.)

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
            lastActivityAt: transaction.lastActivityAt ?? null,
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
        inChain={transaction.chainLinkId !== null}
      />
      <ReconcileLaterAsync
        transactionId={id}
        chainLinkId={transaction.chainLinkId ?? null}
        tenure={transaction.tenure ?? null}
        purchaseType={transaction.purchaseType ?? null}
      />
      {/* ── Zone 1: Hero ── */}
      <div style={{ marginBottom: 20 }}>
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
          photoUrl={heroPhotoUrl}
          overridePredictedDate={transaction.overridePredictedDate ?? null}
          topRightSlot={heroTopRightSlot}
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
      </div>

      {/* Zone 2 (stats strip) retired 2026-08-08 — sale price / purchase
          type / tenure / expected exchange now live inside the hero's
          stat row. */}

      {/* ── Zone 3: Navigation + Zone 4: Milestone strip (in beforeContent)
             + Zone 5: Content grid ── all inside PropertyFileTabs.
           Milestone strip is computed on the page critical path here and
           passed as `beforeContent` so it renders full-width, above the
           tab content grid, on every tab (Zone 4 per spec). */}
      <RevealCoordinator slots={["sidebar", "overview"]}>
      <PropertyFileTabs
        tabs={tabs}
        sidebar={sidebar}
        initialTab={initialTab}
        heroConnected
        beforeContent={
          <GlassCard glassId="milestone-timeline" label="Milestone timeline strip" defaultVariant="v00" style={{
            borderRadius: 10,
            padding: "12px 18px",
          }}>
            <MilestoneTimelineStrip
              stages={resolveDisplayStages(
                [
                  ...(milestoneData?.vendor ?? []),
                  ...(milestoneData?.purchaser ?? []),
                ],
                {
                  expectedExchangeDate: transaction.expectedExchangeDate ?? null,
                  overridePredictedDate: transaction.overridePredictedDate ?? null,
                  targetCompletionDate: transaction.completionDate ?? null,
                },
              ) as MilestoneStage[]}
            />
          </GlassCard>
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
              isEllis={session.user.email === "ellis@thesalesprogressor.co.uk"}
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

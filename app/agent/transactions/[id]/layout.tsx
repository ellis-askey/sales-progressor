// Agent file-detail SHELL (layout).
//
// 2026-09-20 perf overhaul (Layer 1). The file page used to be one route that
// rendered every tab's async server component at once — opening a file fired
// ~9 tab queries + sidebar + Overview simultaneously and saturated the DB
// connection pool, so even the visible content crawled and each panel streamed
// in behind its own skeleton.
//
// Now the shell lives here and each tab is its own route segment (page.tsx =
// Overview, ./chain, ./milestones, ...). A layout is NOT re-rendered when you
// navigate between its child routes, so the hero / milestone strip / sidebar /
// tab bar mount once and never re-fetch or re-flash. Opening a file renders
// only this shell + the Overview segment; other tabs load on click and are
// cached client-side after.
//
// The shell resolves its trunk (session + transaction + flags) via the shared
// loadFilePageContext cache, so it and the active tab segment share a single
// transaction query on a cold load.

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { getMilestonesCached } from "@/lib/services/cached-fetchers";
import { calculateProgress, computeEffectiveStartDate, detectPhase } from "@/lib/services/fees";
import { isExchangeOverdueStuck } from "@/lib/services/exchange-prediction";
import { totalHoldMs } from "@/lib/services/hold-duration";
import { ReviseExchangeBanner } from "@/components/transaction/ReviseExchangeBanner";
import { DemoFileMarker } from "@/components/transaction/DemoFileMarker";

import { PropertyHero } from "@/components/transaction/PropertyHero";
import { FileProgressProvider } from "@/components/transaction/FileProgressContext";
import { FileTabsChrome } from "@/components/transaction/FileTabsChrome";
import { MilestoneTimelineStrip, type MilestoneStage } from "@/components/transaction/MilestoneTimelineStrip";
import { resolveDisplayStages, resolveExchangeDayGate } from "@/lib/milestones/display-stages";
import { EmailSettingsButton } from "@/components/transaction/EmailSettingsDrawer";
import { MosConfirmedNotice } from "@/components/transaction/MosConfirmedNotice";
import { RemindersReadyNotice } from "@/components/transaction/RemindersReadyNotice";
import { ClaimedToast } from "@/components/transaction/ClaimedToast";
import { ChainSetupFailedBanner } from "@/components/transaction/ChainSetupFailedBanner";
import { OnHoldBanner } from "@/components/transaction/OnHoldBanner";
import { RelistBanner } from "@/components/transaction/RelistBanner";
import { RoundChip } from "@/components/transaction/RoundChip";
import { TransactionViewTracker } from "@/components/agent/TransactionViewTracker";
import { FileTimeTracker } from "@/components/transaction/FileTimeTracker";

import { SidebarPanel } from "@/components/transaction/SidebarPanel";
import { getFileSetup } from "@/lib/services/file-setup";
import { EnquiryCourtChipSection } from "@/components/transaction/EnquiryCourtChipSection";
import { ExchangeDayControl } from "@/components/transaction/ExchangeDayControl";
import { ExchangeDayReadyBanner } from "@/components/transaction/ExchangeDayReadyBanner";
import { getExchangeDayState, getExchangeDayAuthority } from "@/lib/services/exchange-day";
import { ClaimWelcomeAsync } from "@/components/transaction/ClaimWelcomeAsync";
import { ReconcileLaterAsync } from "@/components/transaction/ReconcileLaterAsync";
import { SidebarPanelSkeleton } from "@/components/transaction/PanelSkeletons";
import { TabBadgeCounts } from "@/components/transaction/TabBadgeCounts";
import { ReassignOwnerControl } from "@/components/transaction/ReassignOwnerControl";
import { listAssignableAgentsForAgency } from "@/lib/services/agency-team";
import { GlassCard } from "@/components/glass/GlassCard";
import { ConfirmReviewTray } from "@/components/confirm-review/ConfirmReviewTray";
import { DemoTourMount } from "@/components/transaction/demo-tour/DemoTourMount";

// Perceived-performance: let the client router reuse the shell for 5 minutes
// after a visit, so bouncing around a working burst never re-renders it.
export const unstable_dynamicStaleTime = 300;

export default async function AgentTransactionFileLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const ctx = await loadFilePageContext(id);
  const { session, transaction, isInternalStaff, isProgressor, isAdminRole, isEllis, isInternalTeam, isDirectorRole, isAgentRole } = ctx;

  const basePath = `/agent/transactions/${transaction.id}`;

  const milestoneData = await getMilestonesCached(id, session.user.agencyId).catch(() => null);

  const showReassign = isDirectorRole && transaction.serviceType === "self_managed";

  // Shell-only parallel fan-out (spSenderIdentity moved to the Activity segment
  // where it's actually used).
  const [agentUser, assignableAgents, heroPhotoUrl] = await Promise.all([
    transaction.agentUserId
      ? prisma.user.findUnique({
          where: { id: transaction.agentUserId },
          select: { id: true, name: true, email: true, firmName: true, image: true },
        })
      : Promise.resolve(null),
    showReassign && session.user.agencyId
      ? listAssignableAgentsForAgency(session.user.agencyId).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof listAssignableAgentsForAgency>>),
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

  // ── Hero-level progress (derived from the critical-path milestones) ───
  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];
  const completedMilestoneCodes = allMilestones.filter((m) => m.isComplete).map((m) => m.code);
  const progressSeed = allMilestones.map((m) => ({
    id: m.id,
    weight: Number(m.weight),
    isComplete: m.isComplete,
    isNotRequired: m.isNotRequired,
  }));
  const allCompletions = allMilestones
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
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

  const lastMilestoneConfirmedAt = allCompletions
    .map((c) => c.completedAt)
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((max, d) => (max && max > d ? max : d), null);
  const exchangeOverdueStuck = isExchangeOverdueStuck({
    exchangedAt: transaction.exchangedAt ?? null,
    expectedExchangeDate: transaction.expectedExchangeDate ?? null,
    overridePredictedDate: transaction.overridePredictedDate ?? null,
    lastMilestoneConfirmedAt,
  });
  const showExchangeOverdueBanner =
    exchangeOverdueStuck.stuck &&
    !!exchangeOverdueStuck.passedDate &&
    (isInternalStaff || session.user.role === "superadmin" || transaction.serviceType === "self_managed");

  const assignedDisplayName = transaction.serviceType === "outsourced"
    ? ((transaction.assignedUser as { name?: string | null } | null)?.name ?? null)
    : (agentUser?.name ?? null);
  const assignedDisplayImage = transaction.serviceType === "outsourced"
    ? ((transaction.assignedUser as { image?: string | null } | null)?.image ?? null)
    : (agentUser?.image ?? null);

  const showChaseTimeline =
    isEllis || (!!session.user.agencyId && transaction.serviceType === "self_managed");

  // File setup completeness (badge). getFileSetup is re-run on the File setup
  // segment; here we only need the remaining count for the tab badge.
  const [fileSetup, exchangeDay, demoTourUser] = await Promise.all([
    getFileSetup(transaction.id).catch(() => null),
    getExchangeDayState(transaction.id).catch(() => null),
    transaction.isDemo
      ? prisma.user
          .findUnique({ where: { id: session.user.id }, select: { demoTourCompletedAt: true, demoTourSkippedAt: true } })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const tabs = [
    { key: "overview",   label: "Overview", icon: "house" },
    { key: "setup",      label: "File setup", badge: fileSetup?.remaining ?? 0, icon: "setup" },
    { key: "milestones", label: "Steps", icon: "steps" },
    { key: "chain",      label: "Chain", icon: "chain" },
    { key: "reminders",  label: "Reminders", badge: 0, icon: "bell" },
    ...(showChaseTimeline ? [{ key: "chase", label: "Chase timeline", icon: "chase" }] : []),
    { key: "todos",      label: "To-Do", badge: 0, icon: "todo" },
    { key: "documents",  label: "Documents", icon: "documents" },
    { key: "activity",   label: "Activity", icon: "activity" },
    ...(isInternalTeam ? [{ key: "whatsapp", label: "WhatsApp", icon: "whatsapp" }] : []),
  ];

  const heroTopRightSlot = (() => {
    const internal =
      session.user.role === "sales_progressor" ||
      session.user.role === "admin" ||
      session.user.role === "superadmin";
    const agencySelfManaged = !internal && transaction.serviceType === "self_managed";
    if (!internal && !agencySelfManaged) return null;
    return <EmailSettingsButton transactionId={transaction.id} />;
  })();

  const sidebar = (
    <Suspense fallback={<SidebarPanelSkeleton />}>
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
          firstOutsourcedFree: transaction.firstOutsourcedFree ?? null,
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
    </Suspense>
  );

  // Exchange-day control (under "View timeline" in the milestone strip).
  const exchangeDayActive = !!exchangeDay && exchangeDay.active && !exchangeDay.exchanged;
  const exchangeAuthority = exchangeDayActive
    ? await getExchangeDayAuthority(transaction.id).catch(() => ({ seller: null, buyer: null }))
    : null;
  const exchangeDayGate = resolveExchangeDayGate(allMilestones);
  const exchangeDayControl = exchangeDay && !exchangeDay.exchanged ? (
    <ExchangeDayControl
      transactionId={transaction.id}
      active={exchangeDay.active}
      completionDate={exchangeDay.completionDate ? exchangeDay.completionDate.toISOString() : null}
      authority={exchangeAuthority}
      locked={!exchangeDayGate.unlocked}
    />
  ) : null;

  const demoTourAutoStart =
    transaction.isDemo && !demoTourUser?.demoTourCompletedAt && !demoTourUser?.demoTourSkippedAt;

  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8">
      <TransactionViewTracker transactionId={id} propertyAddress={transaction.propertyAddress} userId={session.user.id} />
      <FileTimeTracker transactionId={id} isOnHold={transaction.status === "on_hold"} />
      <Suspense><MosConfirmedNotice /></Suspense>
      <Suspense><RemindersReadyNotice transactionId={id} /></Suspense>
      <Suspense><ClaimedToast address={transaction.propertyAddress} /></Suspense>
      <ClaimWelcomeAsync address={transaction.propertyAddress} transactionId={transaction.id} chainLinkId={transaction.chainLinkId ?? null} />
      <Suspense><ChainSetupFailedBanner /></Suspense>
      <OnHoldBanner show={transaction.status === "on_hold"} />
      {exchangeDayActive && !(exchangeDayGate.sellerReady && exchangeDayGate.buyerReady) && (
        <ExchangeDayReadyBanner sellerReady={exchangeDayGate.sellerReady} buyerReady={exchangeDayGate.buyerReady} />
      )}
      {transaction.isDemo && <DemoFileMarker transactionId={transaction.id} />}
      {showExchangeOverdueBanner && (
        <ReviseExchangeBanner
          transactionId={transaction.id}
          address={transaction.propertyAddress}
          passedDateIso={exchangeOverdueStuck.passedDate!.toISOString()}
        />
      )}
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

      {/* Badge counts (Reminders + To-Do) stream in without blocking paint. */}
      <Suspense fallback={null}>
        <TabBadgeCounts
          transactionId={transaction.id}
          agencyId={session.user.agencyId ?? ""}
          transactionStatus={transaction.status}
          isInternalStaff={isInternalStaff}
        />
      </Suspense>

      <FileProgressProvider seed={progressSeed} fallbackPercent={progress.percent}>
        {/* ── Zone 1: Hero ── */}
        <div id="file-hero" style={{ marginBottom: 20, scrollMarginTop: 12 }}>
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
            assignedUserImage={assignedDisplayImage}
            createdAt={transaction.createdAt}
            transactionId={transaction.id}
            inChain={!!transaction.chainLinkId}
            isAdminViewer={isAdminRole}
            canAgentHandOver={session.user.role === "director" && transaction.serviceType === "self_managed" && transaction.status === "active"}
            photoUrl={heroPhotoUrl}
            overridePredictedDate={transaction.overridePredictedDate ?? null}
            topRightSlot={heroTopRightSlot}
            exchanged={transaction.exchangedAt !== null}
            isShareOfFreehold={transaction.isShareOfFreehold}
            enquiryChipSlot={<EnquiryCourtChipSection transactionId={transaction.id} />}
            roundChipSlot={
              <RoundChip
                transactionId={transaction.id}
                status={transaction.status}
                activeRoundNumber={transaction.activeBuyerRound?.roundNumber ?? null}
                activeBuyerName={
                  transaction.contacts.find((c) => c.roleType === "purchaser")?.name ?? null
                }
                buyerRounds={transaction.buyerRounds ?? []}
              />
            }
          />
        </div>

        {/* ── Zone 3: tab bar + Zone 4: milestone strip + Zone 5: active tab ── */}
        <FileTabsChrome
          tabs={tabs}
          sidebar={sidebar}
          basePath={basePath}
          heroConnected
          tourSlot={transaction.isDemo ? <DemoTourMount autoStart={demoTourAutoStart} /> : undefined}
          beforeContent={
            <GlassCard glassId="milestone-timeline" label="Milestone timeline strip" defaultVariant="v25" className="ms-timeline-lite" style={{
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
                exchangeDaySlot={exchangeDayControl}
                exchangeDayActive={exchangeDayActive}
              />
            </GlassCard>
          }
        >
          {children}
        </FileTabsChrome>
      </FileProgressProvider>

      <ConfirmReviewTray transactionId={transaction.id} />
    </div>
  );
}

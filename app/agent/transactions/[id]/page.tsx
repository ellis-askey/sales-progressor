import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getTransaction, getTransactionByScope } from "@/lib/services/transactions";
import { getAccessScope } from "@/lib/security/access-scope";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction, getGraceDaysByMilestoneCode } from "@/lib/services/reminders";
import { getActivityTimeline, getAutomatedEmailCountsByContact } from "@/lib/services/comms";
import type { ActivityEntry } from "@/lib/services/comms";
import { getLastUpdate, relativeDate } from "@/lib/services/summary";
import { listManualTasksForTransaction } from "@/lib/services/manual-tasks";
import { toUKDateStr } from "@/lib/utils";
import { calculateProgress, computeEffectiveStartDate, detectPhase } from "@/lib/services/fees";
import { totalHoldMs } from "@/lib/services/hold-duration";
import { PropertyHero } from "@/components/transaction/PropertyHero";
import { PropertyFileTabs } from "@/components/transaction/PropertyFileTabs";
import { StatusControl } from "@/components/transaction/StatusControl";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { MilestonePanel } from "@/components/milestones/MilestonePanel";
import { RemindersSection } from "@/components/reminders/RemindersSection";
import { ActivityTab } from "@/components/activity/ActivityTab";
import { TransactionSidebar } from "@/components/transaction/TransactionSidebar";
import { SolicitorSection } from "@/components/solicitors/SolicitorSection";
import { BrokerSection } from "@/components/transaction/BrokerSection";
import { TransactionNotes } from "@/components/transaction/TransactionNotes";
import { ManualTaskList } from "@/components/todos/ManualTaskList";
import { PropertyIntelCard } from "@/components/property/PropertyIntelCard";
import { FileHealthBanner } from "@/components/transaction/FileHealthBanner";
import { RemindersWidget } from "@/components/transaction/RemindersWidget";
import { RecentActivityWidget } from "@/components/transaction/RecentActivityWidget";
import { NextMilestoneWidget, type MilestoneSideState } from "@/components/transaction/NextMilestoneWidget";
import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { ComposeEmail } from "@/components/verified-emails/ComposeEmail";
import { MosConfirmedNotice } from "@/components/transaction/MosConfirmedNotice";
import { RemindersReadyNotice } from "@/components/transaction/RemindersReadyNotice";
import { ClaimedToast } from "@/components/transaction/ClaimedToast";
import { ClaimWelcomeModal } from "@/components/transaction/ClaimWelcomeModal";
import { ChainSetupFailedBanner } from "@/components/transaction/ChainSetupFailedBanner";
import { ReconcileLaterBanner } from "@/components/transaction/ReconcileLaterBanner";
import { OnHoldBanner } from "@/components/transaction/OnHoldBanner";
import { AutomationControls } from "@/components/transaction/AutomationControls";
import { TransactionViewTracker } from "@/components/agent/TransactionViewTracker";
import { FileTimeTracker } from "@/components/transaction/FileTimeTracker";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getClientChaseStatesForTransaction } from "@/lib/services/client-chase-state";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";

export default async function AgentTransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; chainSetupFailed?: string; newUser?: string }>;
}) {
  const [{ id }, { tab: initialTab, newUser }] = await Promise.all([params, searchParams]);
  const session = await requireSession();

  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdminRole  = session.user.role === "admin";
  const txScope = isInternalStaff ? getAccessScope(session) : null;

  const [transaction, milestoneData, reminderLogs, activityEntries, lastUpdate, manualTasks, graceDaysMap, clientChaseByCode, automatedEmails, automatedEmailCounts] = await Promise.all([
    // Internal staff: use scope-based fetch (admin sees all; progressor sees their assigned files).
    // Agent callers (director/negotiator): use agencyId-based fetch unchanged.
    isInternalStaff
      ? getTransactionByScope(id, txScope!)
      : getTransaction(id, session.user.agencyId),
    getMilestonesForTransaction(id, session.user.agencyId).catch(() => null),
    getReminderLogsForTransaction(id, session.user.agencyId).catch(() => []),
    getActivityTimeline(id, session.user.agencyId).catch(() => []),
    getLastUpdate(id).catch(() => null),
    listManualTasksForTransaction(id, session.user.agencyId).catch(() => []),
    getGraceDaysByMilestoneCode().catch(() => new Map<string, number>()),
    // B6 of the client-chase arc — aggregated per-milestone chase state for
    // the chip rendered by MilestoneRow. Returns {} when the chase feature
    // is flag-gated off (no ClientChaseState rows yet); the chip simply
    // doesn't render in that case.
    getClientChaseStatesForTransaction(id).catch(() => ({})),
    // Automated-emails preview — pending + sent today + predicted upcoming
    // for the AutomatedEmailsCard at the top of the Reminders tab.
    getAutomatedEmailsForTransaction(id).catch(() => ({ pending: [], sentToday: [], upcoming: [] })),
    // Per-contact tally of automated emails fired against this file. Drives
    // the small "5 auto emails" pill on each ContactsSection row so an
    // over-chased recipient is visible at a glance.
    getAutomatedEmailCountsByContact(id).catch(() => ({} as Record<string, number>)),
  ]);
  // Maps don't serialise across the server→client boundary; flatten to a
  // plain object for the MilestonePanel prop.
  const graceDaysByCode: Record<string, number> = Object.fromEntries(graceDaysMap);

  if (!transaction) notFound();
  const isDirectorRole = session.user.role === "director";
  // Agent ownership check: director sees all; negotiator only sees their own files.
  // Internal staff bypass: getTransactionByScope already enforces access scope above.
  if (!isInternalStaff && !isDirectorRole && transaction.agentUserId !== session.user.id) notFound();

  // MOS document signed URL (if uploaded during file creation)
  const mosDoc = await prisma.transactionDocument.findFirst({
    where: { transactionId: id, source: "mos" },
    select: { storagePath: true },
    orderBy: { createdAt: "asc" },
  }).catch(() => null);
  let mosDocUrl: string | null = null;
  if (mosDoc) {
    const { getSignedUrl } = await import("@/lib/supabase-storage");
    mosDocUrl = await getSignedUrl(mosDoc.storagePath, 86400).catch(() => null);
  }

  // Only fetch when the claim welcome modal actually needs it (newUser=1 param)
  const originatorAgency = newUser === "1" && transaction.chainLinkId
    ? await prisma.chainLink.findUnique({
        where: { id: transaction.chainLinkId },
        select: { createdBy: { select: { firmName: true } } },
      }).then(l => l?.createdBy?.firmName ?? null).catch(() => null)
    : null;

  // Milestone definitions for the reconcile-later banner. Only fetched for claimed
  // files since the banner only fires when the agent chose "I'll set this up later"
  // during the claim flow (localStorage flag set client-side).
  const reconcileMilestoneDefinitions = transaction.chainLinkId
    ? await prisma.milestoneDefinition.findMany({
        orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
        select: { id: true, code: true, name: true, side: true, orderIndex: true, blocksExchange: true },
      }).catch(() => [])
    : [];

  const [assignedUser, currentUserNotifications] = await Promise.all([
    transaction.assignedUserId
      ? prisma.user.findUnique({
          where: { id: transaction.assignedUserId },
          select: { clientType: true, legacyFee: true },
        })
      : Promise.resolve(null),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { chainDeclineNotificationAddress: true, chainDeclineNotificationAt: true },
    }),
  ]);

  // Resolve sender identity for SP/admin: look for their verified email at the
  // file's agency domain; fall back to the platform sender.
  let spSenderIdentity: { name: string; email: string } | undefined;
  if (isInternalStaff && (isProgressor || isAdminRole)) {
    const agencyId = (transaction as { agencyId?: string | null }).agencyId;
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

  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ].map((m) => ({
    code: m.code,
    isComplete: m.isComplete,
    isNotRequired: m.isNotRequired,
    completedAt: m.completion?.completedAt ?? undefined,
  }));

  const completedMilestoneCodes = allMilestones
    .filter((m) => m.isComplete)
    .map((m) => m.code);

  // For claim-reconciled files, anchor prediction on the earliest reconciliation
  // eventDate so the 12-week target + on-track classification reflect the real
  // sale start, not the moment the agent claimed.
  const allCompletions = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ]
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
  const effectiveStartDate = computeEffectiveStartDate(transaction.createdAt, allCompletions);

  // Hold-aware elapsed time: subtract total on-hold ms so weeks-elapsed and
  // velocity-based predictions freeze while the file is paused. Status
  // also drives the on_hold onTrack pill.
  const holdInput = {
    status: transaction.status,
    holdPeriods: transaction.holdPeriods,
  };
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

  const exchangeConfirmed = allMilestones.some(
    (m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete
  );

  const internalNotes = (activityEntries as ActivityEntry[])
    .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> =>
      e.kind === "comm" &&
      e.type === "internal_note" &&
      !(typeof e.content === "string" && e.content.includes("viewed their client portal"))
    )
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.at, createdByName: e.createdByName }));

  // Key Dates surfaces real-world event dates only — survey/valuation/mortgage
  // offer/exchange/completion target — never "the day we ticked this step done".
  // The semantic flag is MilestoneDefinition.eventDateRequired (per
  // docs/reference/PRODUCT_TRUTH.md). Without the eventDateRequired guard the
  // sidebar previously surfaced every completion that happened to have an
  // eventDate populated — which included migrated sales where eventDate had
  // been written on every step.
  const keyDates = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ]
    .filter((m) => m.eventDateRequired && m.completion?.eventDate)
    .map((m) => ({
      name: m.name,
      eventDate: m.completion!.eventDate as Date,
    }))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  const now = new Date();
  const todayUKStr = toUKDateStr(now);
  const activeReminders = reminderLogs.filter((l) => l.status === "active");

  const activeReminderCount = activeReminders.filter((l) =>
    l.chaseTasks.some((t: { status: string }) => t.status === "pending")
  ).length;

  const overdueCount = activeReminders.filter((l) => {
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    return toUKDateStr(l.nextDueDate) < todayUKStr;
  }).length;

  const reminderBadgeCount = reminderLogs.filter((l) => {
    if (l.status !== "active") return false;
    if (l.snoozedUntil && new Date(l.snoozedUntil) > now) return false;
    if (l.chaseTasks.some((t: { status: string; priority: string }) => t.status === "pending" && t.priority === "escalated")) return true;
    return toUKDateStr(l.nextDueDate) <= todayUKStr;
  }).length;

  const topReminders = activeReminders.slice(0, 2).map((l) => ({
    id: l.id,
    ruleName: l.reminderRule.name,
    nextDueDate: l.nextDueDate,
    snoozedUntil: l.snoozedUntil ?? null,
    pendingChaseCount: l.chaseTasks.filter((t: { status: string }) => t.status === "pending").length,
  }));

  const EXCHANGE_MILESTONES = new Set(["VM19", "PM26"]);
  const COMPLETION_MILESTONES = new Set(["VM20", "PM27"]);
  const EXCHANGE_GATES = new Set(["VM18", "PM25"]);

  function computeMilestoneSideState(
    milestones: Array<{ id: string; name: string; code: string; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean; eventDateRequired: boolean }>
  ): MilestoneSideState {
    // Regular next milestone — excludes exchange gates, exchange milestones, and completion milestones
    const next = milestones.find(
      (m) => !m.isComplete && !m.isNotRequired && m.isAvailable
        && !EXCHANGE_MILESTONES.has(m.code) && !EXCHANGE_GATES.has(m.code) && !COMPLETION_MILESTONES.has(m.code)
    );
    if (next) return { state: "hasNext", milestone: { id: next.id, name: next.name, code: next.code, eventDateRequired: next.eventDateRequired } };

    const hasGatePending = milestones.some((m) => !m.isComplete && !m.isNotRequired && EXCHANGE_GATES.has(m.code));
    if (hasGatePending) return { state: "gatePending", gateType: "exchange_gate" };

    // Exchange milestone (VM19/PM26) not yet confirmed
    const hasExchangePending = milestones.some((m) => !m.isComplete && !m.isNotRequired && EXCHANGE_MILESTONES.has(m.code));
    if (hasExchangePending) return { state: "gatePending", gateType: "post_exchange" };

    // Completion milestone — only actionable once exchange is confirmed (isAvailable) and the completion date has arrived
    const completionMilestone = milestones.find(
      (m) => COMPLETION_MILESTONES.has(m.code) && !m.isComplete && !m.isNotRequired && m.isAvailable
    );
    if (completionMilestone) {
      if (transaction?.completionDate) {
        const cd = new Date(transaction.completionDate);
        if (toUKDateStr(cd) > todayUKStr) return { state: "completionPending", completionDate: cd };
      }
      return { state: "hasNext", milestone: { id: completionMilestone.id, name: completionMilestone.name, code: completionMilestone.code, eventDateRequired: completionMilestone.eventDateRequired } };
    }

    return { state: "allComplete" };
  }

  const vendorSideState: MilestoneSideState = milestoneData
    ? computeMilestoneSideState(milestoneData.vendor)
    : { state: "allComplete" };

  const purchaserSideState: MilestoneSideState = milestoneData
    ? computeMilestoneSideState(milestoneData.purchaser)
    : { state: "allComplete" };

  const openTodoCount = isInternalStaff
    ? manualTasks.filter((t) => t.status === "open" && t.isAgentRequest).length
    : manualTasks.filter((t) => t.status === "open").length;

  const escalatedCount = reminderLogs.flatMap((l) =>
    l.chaseTasks.filter((t: { status: string; priority: string }) => t.status === "pending" && t.priority === "escalated")
  ).length;

  const lastMilestoneCompletion = allMilestones
    .filter((m) => m.isComplete && m.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

  const daysStuckOnMilestone = lastMilestoneCompletion?.completedAt
    ? Math.floor((Date.now() - new Date(lastMilestoneCompletion.completedAt).getTime()) / 86400000)
    : null;

  const lastActivityMs = activityEntries.length > 0
    ? new Date((activityEntries[0] as { at: Date }).at).getTime()
    : null;
  const daysSinceLastActivity = lastActivityMs
    ? Math.floor((Date.now() - lastActivityMs) / 86400000)
    : null;

  const riskInput = {
    onTrack: progress.onTrack,
    escalatedTaskCount: escalatedCount,
    overdueTaskCount: overdueCount,
    daysSinceLastActivity,
    daysStuckOnMilestone,
  };

  const tabs = [
    { key: "overview",   label: "Overview" },
    { key: "milestones", label: "Steps" },
    { key: "reminders",  label: "Reminders", badge: reminderBadgeCount },
    { key: "todos",      label: "To-Do", badge: openTodoCount },
    { key: "activity",   label: "Activity" },
  ];

  const agentUser = transaction.agentUserId
    ? await prisma.user.findUnique({
        where: { id: transaction.agentUserId },
        select: { id: true, name: true, email: true, firmName: true },
      })
    : null;

  const assignedDisplayName =
    (transaction.assignedUser as { name?: string | null } | null)?.name ??
    agentUser?.name ??
    null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendedFirms = isDirectorRole
    ? await db.agencyRecommendedSolicitor.findMany({
        where: { agencyId: session.user.agencyId },
        orderBy: { solicitorFirm: { name: "asc" } },
        select: { solicitorFirmId: true, defaultReferralFeePence: true, solicitorFirm: { select: { name: true } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).then((rows: any[]) => rows.map((r) => ({
        id: r.solicitorFirmId as string,
        name: r.solicitorFirm.name as string,
        defaultReferralFeePence: r.defaultReferralFeePence as number | null,
      })))
    : null;

  const INTERNAL_ROLES = ["superadmin", "admin", "sales_progressor"] as const;
  const isInternal = (INTERNAL_ROLES as readonly string[]).includes(session.user.role);

  const fileTimeSessions = await prisma.fileTimeSession.findMany({
    where: { transactionId: id },
    select: { totalEngagedSeconds: true, lastActivityAt: true, endedAt: true, user: { select: { role: true } } },
  }).catch(() => []);

  const liveCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const closedSessions = fileTimeSessions.filter((s) => s.endedAt !== null && (s.totalEngagedSeconds ?? 0) > 0);

  const agentSeconds = closedSessions
    .filter((s) => !(INTERNAL_ROLES as readonly string[]).includes(s.user.role))
    .reduce((sum, s) => sum + (s.totalEngagedSeconds ?? 0), 0);
  const teamSeconds = closedSessions
    .filter((s) => (INTERNAL_ROLES as readonly string[]).includes(s.user.role))
    .reduce((sum, s) => sum + (s.totalEngagedSeconds ?? 0), 0);

  const mostRecentActivity = fileTimeSessions
    .map((s) => s.lastActivityAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  const hasLiveSession = fileTimeSessions.some(
    (s) => s.endedAt === null && new Date(s.lastActivityAt) > liveCutoff
  );

  const fileTime = {
    agentSeconds,
    teamSeconds,
    totalSeconds: agentSeconds + teamSeconds,
    lastActiveAt: mostRecentActivity,
    hasLiveSession,
  };

  const brokerRow = await Promise.resolve().then(() =>
    prisma.propertyTransaction.findFirst({
      // Internal staff: fetch by id only (agencyId not applicable).
      // Agents: filter by agencyId to enforce ownership.
      where: isInternalStaff ? { id } : { id, agencyId: session.user.agencyId },
      select: {
        brokerFirmId: true,
        brokerContactId: true,
        brokerReferralFee: true,
        brokerReferralFeeReceived: true,
        purchaserBrokerReferral: true,
        brokerFirm: { select: { id: true, name: true } },
        brokerContact: { select: { id: true, name: true } },
      },
    })
  ).catch(() => null);

  const sidebar = (
    <TransactionSidebar
      transaction={{
        id: transaction.id,
        propertyAddress: transaction.propertyAddress,
        purchasePrice: transaction.purchasePrice ?? null,
        tenure: transaction.tenure ?? null,
        purchaseType: transaction.purchaseType ?? null,
        isShareOfFreehold: transaction.isShareOfFreehold,
        chainLinkId: transaction.chainLinkId ?? null,
        overridePredictedDate: transaction.overridePredictedDate ?? null,
        completionDate: transaction.completionDate ?? null,
        agentFeeAmount: transaction.agentFeeAmount ?? null,
        agentFeePercent: transaction.agentFeePercent ? Number(transaction.agentFeePercent) : null,
        agentFeeIsVatInclusive: transaction.agentFeeIsVatInclusive ?? null,
        referralFee: transaction.referralFee ?? null,
        referredFirmName: transaction.referredFirm?.name ?? null,
        referredFirmId: transaction.referredFirmId ?? null,
        brokerReferralFee: brokerRow?.brokerReferralFee ?? null,
        brokerFirmName: brokerRow?.brokerFirm?.name ?? null,
        serviceType: transaction.serviceType ?? null,
      }}
      recommendedFirms={recommendedFirms}
      showOurFee={session.user.role === "director" || session.user.role === "admin"}
      assignedUser={assignedUser}
      agentUser={agentUser}
      progress={progress}
      keyDates={keyDates}
      exchangeConfirmed={exchangeConfirmed}
      fileTime={fileTime}
      isInternal={isInternal}
      hideCommercialFields={isProgressor}
    />
  );

  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8">
      <TransactionViewTracker transactionId={id} propertyAddress={transaction.propertyAddress} userId={session.user.id} />
      <FileTimeTracker transactionId={id} isOnHold={transaction.status === "on_hold"} />
      <Suspense><MosConfirmedNotice /></Suspense>
      <Suspense><RemindersReadyNotice transactionId={id} /></Suspense>
      <Suspense><ClaimedToast address={transaction.propertyAddress} /></Suspense>
      <Suspense><ClaimWelcomeModal address={transaction.propertyAddress} originatorAgency={originatorAgency ?? undefined} /></Suspense>
      <Suspense><ChainSetupFailedBanner /></Suspense>
      <OnHoldBanner show={transaction.status === "on_hold"} />
      {transaction.chainLinkId && reconcileMilestoneDefinitions.length > 0 && (
        <ReconcileLaterBanner
          transactionId={id}
          milestoneDefinitions={reconcileMilestoneDefinitions}
          tenure={transaction.tenure ?? null}
          purchaseType={transaction.purchaseType ?? null}
        />
      )}
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
      />

      <PropertyFileTabs tabs={tabs} sidebar={sidebar} initialTab={initialTab} heroConnected>
        {/* ── Tab 0: Overview ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <FileHealthBanner overdueCount={overdueCount} onTrack={progress.onTrack} />

          {transaction.serviceType === "self_managed" &&
            (transaction.status === "active" || transaction.status === "on_hold") && (
              <AutomationControls
                transactionId={transaction.id}
                initialClientEmailsPaused={transaction.clientEmailsPaused}
                status={transaction.status as "active" | "on_hold"}
              />
            )}

          <ContactsSection
            transactionId={transaction.id}
            contacts={transaction.contacts}
            address={transaction.propertyAddress}
            portalViewDates={Object.fromEntries(
              transaction.contacts
                .filter((c) => c.lastVisitedPortalAt)
                .map((c) => [c.id, c.lastVisitedPortalAt as Date])
            )}
            automatedEmailCounts={automatedEmailCounts}
          />

          <NextMilestoneWidget
            transactionId={transaction.id}
            vendorSide={vendorSideState}
            purchaserSide={purchaserSideState}
          />

          <RemindersWidget reminders={topReminders} totalActive={overdueCount} />
          <RecentActivityWidget entries={activityEntries} />

          <div id="chain-section" className="glass-card overflow-hidden rounded-[12px]">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>Property chain</h3>
              <ViewChainButton
                transactionId={transaction.id}
                currentUserId={session.user.id}
                declineNotification={
                  currentUserNotifications?.chainDeclineNotificationAddress &&
                  currentUserNotifications?.chainDeclineNotificationAt
                    ? {
                        address: currentUserNotifications.chainDeclineNotificationAddress,
                        at: currentUserNotifications.chainDeclineNotificationAt.toISOString(),
                      }
                    : null
                }
              />
            </div>
          </div>

          <SolicitorSection
            transactionId={transaction.id}
            vendor={{
              firm: transaction.vendorSolicitorFirm ?? null,
              contact: transaction.vendorSolicitorContact ?? null,
            }}
            purchaser={{
              firm: transaction.purchaserSolicitorFirm ?? null,
              contact: transaction.purchaserSolicitorContact ?? null,
            }}
            recommendedFirms={recommendedFirms ?? undefined}
            referredFirmId={transaction.referredFirmId ?? null}
            referralFee={transaction.referralFee ?? null}
            address={transaction.propertyAddress}
            contacts={transaction.contacts.map((c) => ({ name: c.name, roleType: c.roleType }))}
          />
          {brokerRow?.brokerFirmId && (
            <BrokerSection
              transactionId={transaction.id}
              brokerFirmId={brokerRow.brokerFirmId}
              brokerContactId={brokerRow.brokerContactId}
              brokerFirmName={brokerRow.brokerFirm?.name ?? null}
              brokerContactName={brokerRow.brokerContact?.name ?? null}
              brokerReferralFee={brokerRow.brokerReferralFee}
              brokerReferralFeeReceived={brokerRow.brokerReferralFeeReceived}
              purchaserBrokerReferral={brokerRow.purchaserBrokerReferral ?? false}
            />
          )}

          <RiskScoreWidget input={riskInput} />

          <PropertyIntelCard transactionId={transaction.id} />
          <TransactionNotes transactionId={transaction.id} initialNotes={internalNotes} currentUserName={session.user.name ?? ""} />
        </div>

        {/* ── Tab 1: Milestones ────────────────────────────────────────── */}
        <div>
          {milestoneData ? (
            <MilestonePanel
              transactionId={transaction.id}
              vendor={milestoneData.vendor}
              purchaser={milestoneData.purchaser}
              exchangeReady={milestoneData.exchangeReady}
              vendorGateReady={milestoneData.vendorGateReady}
              purchaserGateReady={milestoneData.purchaserGateReady}
              graceDaysByCode={graceDaysByCode}
              clientChaseByCode={clientChaseByCode}
              purchaseType={transaction.purchaseType}
            />
          ) : (
            <p className="text-sm text-slate-900/40 text-center py-12">No milestone data available</p>
          )}
        </div>

        {/* ── Tab 2: Reminders ─────────────────────────────────────────── */}
        <div>
          <RemindersSection
            transactionId={transaction.id}
            reminderLogs={reminderLogs}
            contacts={transaction.contacts}
            propertyAddress={transaction.propertyAddress}
            completedMilestoneCodes={new Set(
              [...(milestoneData?.vendor ?? []), ...(milestoneData?.purchaser ?? [])]
                .filter((m) => m.isComplete || m.isNotRequired)
                .map((m) => m.code)
            )}
            automatedEmails={automatedEmails}
            transactionStatus={transaction.status}
          />
        </div>

        {/* ── Tab 3: To-Do ─────────────────────────────────────────────── */}
        <div>
          <ManualTaskList
            initialTasks={manualTasks}
            transactionId={transaction.id}
            transactionAddress={transaction.propertyAddress}
            showDone
            showOwnership={transaction.serviceType === "outsourced" && !isProgressor && !isAdminRole}
            perspective={isInternalStaff ? "progressor" : "agent"}
          />
        </div>

        {/* ── Tab 4: Activity ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <ActivityTab
            entries={activityEntries}
            transactionId={transaction.id}
            mosDocUrl={mosDocUrl}
            currentUserId={isProgressor ? session.user.id : undefined}
            contacts={transaction.contacts}
            solicitors={[
              ...(transaction.vendorSolicitorContact
                ? [{ id: transaction.vendorSolicitorContact.id, name: transaction.vendorSolicitorContact.name, role: "Vendor solicitor", phone: transaction.vendorSolicitorContact.phone ?? null }]
                : []),
              ...(transaction.purchaserSolicitorContact
                ? [{ id: transaction.purchaserSolicitorContact.id, name: transaction.purchaserSolicitorContact.name, role: "Purchaser solicitor", phone: transaction.purchaserSolicitorContact.phone ?? null }]
                : []),
            ]}
            canPasteChat={isProgressor || isAdminRole}
            currentUserName={session.user.name ?? ""}
            currentUserRole={session.user.role ?? ""}
          />
          {(!isInternal || spSenderIdentity !== undefined) && (
            <ComposeEmail transactionId={transaction.id} senderIdentity={spSenderIdentity} />
          )}
        </div>
      </PropertyFileTabs>
    </div>
  );
}

function MetaField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <p className="text-xs font-medium text-slate-900/40 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

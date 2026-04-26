import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getTransaction } from "@/lib/services/transactions";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction } from "@/lib/services/reminders";
import { getActivityTimeline } from "@/lib/services/comms";
import type { ActivityEntry } from "@/lib/services/comms";
import { getLastUpdate, relativeDate } from "@/lib/services/summary";
import { listManualTasksForTransaction } from "@/lib/services/manual-tasks";
import { calculateProgress } from "@/lib/services/fees";
import { PropertyHero } from "@/components/transaction/PropertyHero";
import { PropertyFileTabs } from "@/components/transaction/PropertyFileTabs";
import { StatusControl } from "@/components/transaction/StatusControl";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { MilestonePanel } from "@/components/milestones/MilestonePanel";
import { RemindersSection } from "@/components/reminders/RemindersSection";
import { CommsEntry } from "@/components/activity/CommsEntry";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { TransactionSidebar } from "@/components/transaction/TransactionSidebar";
import { SolicitorSection } from "@/components/solicitors/SolicitorSection";
import { TransactionNotes } from "@/components/transaction/TransactionNotes";
import { ManualTaskList } from "@/components/todos/ManualTaskList";
import { PropertyIntelCard } from "@/components/property/PropertyIntelCard";
import { FileHealthBanner } from "@/components/transaction/FileHealthBanner";
import { RemindersWidget } from "@/components/transaction/RemindersWidget";
import { RecentActivityWidget } from "@/components/transaction/RecentActivityWidget";
import { NextMilestoneWidget } from "@/components/transaction/NextMilestoneWidget";
import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import { ChainWidget } from "@/components/chain/ChainWidget";
import { EmailParseWidget } from "@/components/activity/EmailParseWidget";
import { ComposeEmail } from "@/components/verified-emails/ComposeEmail";
import { MosConfirmedNotice } from "@/components/transaction/MosConfirmedNotice";
import { RemindersReadyNotice } from "@/components/transaction/RemindersReadyNotice";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";

export default async function AgentTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [transaction, milestoneData, reminderLogs, activityEntries, lastUpdate, manualTasks] = await Promise.all([
    getTransaction(id, session.user.agencyId),
    getMilestonesForTransaction(id, session.user.agencyId).catch(() => null),
    getReminderLogsForTransaction(id, session.user.agencyId).catch(() => []),
    getActivityTimeline(id, session.user.agencyId).catch(() => []),
    getLastUpdate(id).catch(() => null),
    listManualTasksForTransaction(id, session.user.agencyId).catch(() => []),
  ]);

  if (!transaction) notFound();
  const isDirectorRole = session.user.role === "director";
  if (!isDirectorRole && transaction.agentUserId !== session.user.id) notFound();

  const assignedUser = transaction.assignedUserId
    ? await prisma.user.findUnique({
        where: { id: transaction.assignedUserId },
        select: { clientType: true, legacyFee: true },
      })
    : null;

  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ].map((m) => ({
    code: m.code,
    isComplete: m.isComplete,
    isNotRequired: m.isNotRequired,
    isPostExchange: m.isPostExchange,
    completedAt: m.activeCompletion?.completedAt,
  }));

  const progress = calculateProgress(
    allMilestones,
    transaction.createdAt,
    transaction.overridePredictedDate ?? null
  );

  const exchangeConfirmed = allMilestones.some(
    (m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete
  );

  const internalNotes = (activityEntries as ActivityEntry[])
    .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> =>
      e.kind === "comm" &&
      e.type === "internal_note" &&
      !(typeof e.content === "string" && e.content.includes("viewed their client portal"))
    )
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.at, createdByName: e.createdByName }));

  const keyDates = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ]
    .filter((m) => m.timeSensitive && m.activeCompletion?.eventDate)
    .map((m) => ({
      name: m.name,
      eventDate: m.activeCompletion!.eventDate as Date,
    }))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeReminders = reminderLogs.filter((l) => l.status === "active");

  const activeReminderCount = activeReminders.filter((l) => {
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due <= today || l.chaseTasks.some((t: { status: string }) => t.status === "pending");
  }).length;

  const overdueCount = activeReminders.filter((l) => {
    const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  const topReminders = activeReminders.slice(0, 2).map((l) => ({
    id: l.id,
    ruleName: l.reminderRule.name,
    nextDueDate: l.nextDueDate,
    pendingChaseCount: l.chaseTasks.filter((t: { status: string }) => t.status === "pending").length,
  }));

  const vendorNext = milestoneData?.vendor.find(
    (m) => !m.isComplete && !m.isNotRequired && m.isAvailable && !m.isPostExchange && !m.isExchangeGate
  ) ?? null;

  const purchaserNext = milestoneData?.purchaser.find(
    (m) => !m.isComplete && !m.isNotRequired && m.isAvailable && !m.isPostExchange && !m.isExchangeGate
  ) ?? null;

  const openTodoCount = manualTasks.filter((t) => t.status === "open").length;

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
    { key: "milestones", label: "Milestones" },
    { key: "reminders",  label: "Reminders", badge: activeReminderCount },
    { key: "todos",      label: "To-Do", badge: openTodoCount },
    { key: "activity",   label: "Activity" },
  ];

  const agentUser = transaction.agentUserId
    ? await prisma.user.findUnique({
        where: { id: transaction.agentUserId },
        select: { id: true, name: true, email: true, firmName: true },
      })
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendedFirms = isDirectorRole
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (prisma as any).agencyRecommendedSolicitor.findMany({
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

  const sidebar = (
    <TransactionSidebar
      transaction={{
        id: transaction.id,
        purchasePrice: transaction.purchasePrice ?? null,
        tenure: transaction.tenure ?? null,
        purchaseType: transaction.purchaseType ?? null,
        overridePredictedDate: transaction.overridePredictedDate ?? null,
        completionDate: transaction.completionDate ?? null,
        agentFeeAmount: transaction.agentFeeAmount ?? null,
        agentFeePercent: transaction.agentFeePercent ? Number(transaction.agentFeePercent) : null,
        agentFeeIsVatInclusive: transaction.agentFeeIsVatInclusive ?? null,
        referralFee: transaction.referralFee ?? null,
        referredFirmName: transaction.referredFirm?.name ?? null,
        referredFirmId: transaction.referredFirmId ?? null,
      }}
      recommendedFirms={recommendedFirms}
      showOurFee={session.user.role === "director"}
      assignedUser={assignedUser}
      agentUser={agentUser}
      progress={progress}
      keyDates={keyDates}
      exchangeConfirmed={exchangeConfirmed}
    />
  );

  return (
    <div className="glass-page agent-page">
      <Suspense><MosConfirmedNotice /></Suspense>
      <Suspense><RemindersReadyNotice transactionId={id} /></Suspense>
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
        backHref="/agent/dashboard"
      />

      <PropertyFileTabs tabs={tabs} sidebar={sidebar}>
        {/* ── Tab 0: Overview ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <FileHealthBanner overdueCount={overdueCount} onTrack={progress.onTrack} />

          <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
            <div className="grid divide-x divide-white/20" style={{ gridTemplateColumns: "130px 160px 1fr" }}>
              <MetaField label="Status">
                <StatusControl transactionId={transaction.id} currentStatus={transaction.status} />
              </MetaField>
              <MetaField label="Assigned to">
                <span className="text-sm text-slate-900/80">
                  {transaction.assignedUser?.name ?? <span className="text-slate-900/30 italic">Unassigned</span>}
                </span>
              </MetaField>
              <MetaField label="Last progress">
                {lastUpdate ? (
                  <div>
                    <p className="text-sm text-slate-900/80 leading-snug line-clamp-2">{lastUpdate.summaryText}</p>
                    <p className="text-xs text-slate-900/40 mt-0.5">{relativeDate(lastUpdate.completedAt)}</p>
                  </div>
                ) : (
                  <span className="text-sm text-slate-900/30 italic">No progress yet</span>
                )}
              </MetaField>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <ContactsSection transactionId={transaction.id} contacts={transaction.contacts} />
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
            />
          </div>

          <NextMilestoneWidget
            transactionId={transaction.id}
            vendorNext={vendorNext ? {
              id: vendorNext.id,
              name: vendorNext.name,
              code: vendorNext.code,
              timeSensitive: vendorNext.timeSensitive,
            } : null}
            purchaserNext={purchaserNext ? {
              id: purchaserNext.id,
              name: purchaserNext.name,
              code: purchaserNext.code,
              timeSensitive: purchaserNext.timeSensitive,
            } : null}
          />

          <div className="grid grid-cols-2 gap-5">
            <RemindersWidget reminders={topReminders} totalActive={activeReminders.length} />
            <RecentActivityWidget entries={activityEntries} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <RiskScoreWidget input={riskInput} />
            <ChainWidget transactionId={transaction.id} />
          </div>

          <PropertyIntelCard transactionId={transaction.id} />
          <TransactionNotes transactionId={transaction.id} initialNotes={internalNotes} />
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
          />
        </div>

        {/* ── Tab 3: To-Do ─────────────────────────────────────────────── */}
        <div>
          <ManualTaskList
            initialTasks={manualTasks}
            transactionId={transaction.id}
            transactionAddress={transaction.propertyAddress}
            showDone
            showOwnership={transaction.serviceType === "outsourced"}
            perspective="agent"
          />
        </div>

        {/* ── Tab 4: Activity ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <EmailParseWidget transactionId={transaction.id} />
          <ComposeEmail transactionId={transaction.id} />
          <CommsEntry transactionId={transaction.id} contacts={transaction.contacts} />
          <ActivityTimeline entries={activityEntries} transactionId={transaction.id} />
        </div>
      </PropertyFileTabs>
    </div>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium text-slate-900/40 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// app/transactions/[id]/page.tsx

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getTransaction } from "@/lib/services/transactions";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction } from "@/lib/services/reminders";
import { getActivityTimeline } from "@/lib/services/comms";
import { getLastUpdate, relativeDate } from "@/lib/services/summary";
import { getPortalViewDates } from "@/lib/services/portal";
import type { ActivityEntry } from "@/lib/services/comms";
import { listManualTasksForTransaction, countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { calculateProgress } from "@/lib/services/fees";
import { AppShell } from "@/components/layout/AppShell";
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
import { NewTransactionToast } from "@/components/transaction/NewTransactionToast";
import { ManualTaskList } from "@/components/todos/ManualTaskList";
import { AssignControl } from "@/components/transaction/AssignControl";
import { PropertyIntelCard } from "@/components/property/PropertyIntelCard";
import { FileHealthBanner } from "@/components/transaction/FileHealthBanner";
import { RemindersWidget } from "@/components/transaction/RemindersWidget";
import { RecentActivityWidget } from "@/components/transaction/RecentActivityWidget";
import { NextMilestoneWidget } from "@/components/transaction/NextMilestoneWidget";
import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import { ChainWidget } from "@/components/chain/ChainWidget";
import { EmailParseWidget } from "@/components/activity/EmailParseWidget";
import { DocumentsSection } from "@/components/transaction/DocumentsSection";
import { prisma } from "@/lib/prisma";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [transaction, milestoneData, reminderLogs, activityEntries, lastUpdate, manualTasks, todoCount] = await Promise.all([
    getTransaction(id, session.user.agencyId),
    getMilestonesForTransaction(id, session.user.agencyId).catch(() => null),
    getReminderLogsForTransaction(id, session.user.agencyId).catch(() => []),
    getActivityTimeline(id, session.user.agencyId).catch(() => []),
    getLastUpdate(id).catch(() => null),
    listManualTasksForTransaction(id, session.user.agencyId).catch(() => []),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  if (!transaction) notFound();

  const portalViewDates = await getPortalViewDates(id).catch(() => ({}));


  // Assigned user fee info
  const assignedUser = transaction.assignedUserId
    ? await prisma.user.findUnique({
        where: { id: transaction.assignedUserId },
        select: { clientType: true, legacyFee: true },
      })
    : null;

  // Build milestone states for progress
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

  // Exchange confirmed when VM12 (vendor exchanged) or PM16 (purchaser exchanged) is complete
  const exchangeConfirmed = allMilestones.some(
    (m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete
  );

  // Internal notes from activity timeline (D1: unified source)
  const internalNotes = (activityEntries as ActivityEntry[])
    .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> =>
      e.kind === "comm" && e.type === "internal_note"
    )
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.at, createdByName: e.createdByName }));

  // Key event dates from time-sensitive milestone completions
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

  // Reminder counts + widget data
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

  // Top 2 reminders for widget (sorted by nextDueDate asc — already sorted from service)
  const topReminders = activeReminders.slice(0, 2).map((l) => ({
    id: l.id,
    ruleName: l.reminderRule.name,
    nextDueDate: l.nextDueDate,
    pendingChaseCount: l.chaseTasks.filter((t: { status: string }) => t.status === "pending").length,
  }));

  // Next available milestone per side
  const vendorNext = milestoneData?.vendor.find(
    (m) => !m.isComplete && !m.isNotRequired && m.isAvailable && !m.isPostExchange && !m.isExchangeGate
  ) ?? null;

  const purchaserNext = milestoneData?.purchaser.find(
    (m) => !m.isComplete && !m.isNotRequired && m.isAvailable && !m.isPostExchange && !m.isExchangeGate
  ) ?? null;

  const openTodoCount = manualTasks.filter((t) => t.status === "open").length;

  // Risk score inputs
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
        }}
        assignedUser={assignedUser}
        agentUser={agentUser}
        progress={progress}
        keyDates={keyDates}
        exchangeConfirmed={exchangeConfirmed}
      />
  );

  return (
    <AppShell session={session} activePath="/dashboard" todoCount={todoCount}>
      <div className="glass-page">
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
      />
      <NewTransactionToast />

      <PropertyFileTabs tabs={tabs} sidebar={sidebar}>
        {/* ── Tab 0: Overview ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* File health banner (conditional) */}
          <FileHealthBanner overdueCount={overdueCount} onTrack={progress.onTrack} />

          {/* Compact meta strip */}
          <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
            <div className="grid grid-cols-3 divide-x divide-white/20">
              <MetaField label="Status">
                <StatusControl transactionId={transaction.id} currentStatus={transaction.status} />
              </MetaField>
              <MetaField label="Assigned to">
                <AssignControl
                  transactionId={transaction.id}
                  currentAssigneeId={transaction.assignedUserId ?? null}
                  currentAssigneeName={transaction.assignedUser?.name ?? null}
                />
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

          {/* People — contacts + solicitors */}
          <div className="grid grid-cols-2 gap-5">
            <ContactsSection transactionId={transaction.id} contacts={transaction.contacts} portalViewDates={portalViewDates} />
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

          {/* Next steps quick-complete */}
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

          {/* Reminders + Recent activity side by side */}
          <div className="grid grid-cols-2 gap-5">
            <RemindersWidget
              reminders={topReminders}
              totalActive={activeReminders.length}
            />
            <RecentActivityWidget entries={activityEntries} />
          </div>

          {/* Risk Score + Chain side by side */}
          <div className="grid grid-cols-2 gap-5">
            <RiskScoreWidget input={riskInput} />
            <ChainWidget transactionId={transaction.id} />
          </div>

          {/* Property Intel */}
          <PropertyIntelCard transactionId={transaction.id} />

          {/* Notes */}
          <TransactionNotes transactionId={transaction.id} initialNotes={internalNotes} />

          {/* Documents uploaded via portal */}
          <DocumentsSection transactionId={transaction.id} />
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
            completedMilestoneCodes={new Set(
              [
                ...(milestoneData?.vendor ?? []),
                ...(milestoneData?.purchaser ?? []),
              ]
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
          />
        </div>

        {/* ── Tab 4: Activity ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <EmailParseWidget transactionId={transaction.id} />
          <CommsEntry transactionId={transaction.id} contacts={transaction.contacts} />
          <ActivityTimeline entries={activityEntries} transactionId={transaction.id} />
        </div>
      </PropertyFileTabs>
      </div>
    </AppShell>
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

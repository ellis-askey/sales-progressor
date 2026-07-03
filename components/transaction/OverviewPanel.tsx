// Async server component for the Overview tab on the file detail page.
// This is the heaviest tab: it pulls milestones, reminders, activity,
// the broker row and a couple of user records, then composes the file-
// health banner, contacts, next-step, reminders widget, recent activity
// widget, chain summary, solicitor + broker sections, risk widget,
// property intel card, and internal notes.
//
// Why so much in one panel: Overview is what most agents land on when
// they open a file. The grouping mirrors the existing page structure
// so swapping the panel in is a like-for-like move. The Suspense
// boundary lives at the page level — the panel streams in once its
// fan-out resolves.
//
// All shared fetchers go through React.cache() so the milestone,
// reminder-log and activity queries are de-duped with the sidebar and
// the other tabs.

import { prisma } from "@/lib/prisma";
import {
  getMilestonesCached,
  getReminderLogsCached,
  getActivityTimelineCached,
  getAutomatedEmailCountsCached,
  getLastContactedByContactCached,
} from "@/lib/services/cached-fetchers";
import { calculateProgress, computeEffectiveStartDate, detectPhase } from "@/lib/services/fees";
import { totalHoldMs } from "@/lib/services/hold-duration";
import { countActionable, countOverdue } from "@/lib/reminders/classify";
import { toUKDateStr } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";
import { FileHealthBanner } from "@/components/transaction/FileHealthBanner";
import { AutomationControls } from "@/components/transaction/AutomationControls";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import type { MilestoneSideState } from "@/components/transaction/NextMilestoneWidget";
import { NextActionCardConsumer } from "@/components/transaction/NextActionCardConsumer";
import { RemindersWidget } from "@/components/transaction/RemindersWidget";
import { RecentActivityWidget } from "@/components/transaction/RecentActivityWidget";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { SolicitorSection } from "@/components/solicitors/SolicitorSection";
import { BrokerSection } from "@/components/transaction/BrokerSection";
import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import { PropertyIntelCard } from "@/components/property/PropertyIntelCard";
import { TransactionNotes } from "@/components/transaction/TransactionNotes";
import { MilestoneTimelineStrip, type MilestoneStage } from "@/components/transaction/MilestoneTimelineStrip";
import { resolveDisplayStages } from "@/lib/milestones/display-stages";
import { AiSummaryCard } from "@/components/transaction/AiSummaryCard";
import { Card } from "@/components/ui/Card";
import type { PurchaseType, Tenure, TransactionStatus } from "@prisma/client";

// Match the canonical Prisma include shape used by getTransaction +
// the props ContactsSection requires (phone/email are nullable but not
// optional).
type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  roleType: string;
  portalToken: string | null;
  createdAt: Date;
  lastVisitedPortalAt?: Date | null;
};

type SolicitorContact = { id: string; name: string; phone: string | null; email: string | null };
type SolicitorFirm = { id: string; name: string };

type Props = {
  transaction: {
    id: string;
    propertyAddress: string;
    purchaseType: PurchaseType | null;
    tenure: Tenure | null;
    isShareOfFreehold: boolean;
    status: TransactionStatus;
    createdAt: Date;
    overridePredictedDate: Date | null;
    expectedExchangeDate: Date | null;
    completionDate: Date | null;
    clientEmailsPaused: boolean;
    chainLinkId?: string | null;
    referredFirmId: string | null;
    referralFee: number | null;
    holdPeriods: Array<{ startedAt: Date; endedAt: Date | null }>;
    contacts: Contact[];
    vendorSolicitorFirm?: SolicitorFirm | null;
    vendorSolicitorContact?: SolicitorContact | null;
    purchaserSolicitorFirm?: SolicitorFirm | null;
    purchaserSolicitorContact?: SolicitorContact | null;
  };
  agencyId: string;
  isInternalStaff: boolean;
  isDirectorRole: boolean;
  currentUserId: string;
  currentUserName: string;
  recommendedFirms?: Array<{ id: string; name: string; defaultReferralFeePence: number | null }> | null;
  // Ellis-only AI summary prototype toggle. When true, the AiSummaryCard
  // renders below the reminders widget on the Overview tab.
  isEllis?: boolean;
};

const EXCHANGE_MILESTONES = new Set(["VM19", "PM26"]);
const COMPLETION_MILESTONES = new Set(["VM20", "PM27"]);
const EXCHANGE_GATES = new Set(["VM18", "PM25"]);

function makeComputeMilestoneSideState(
  completionDate: Date | null,
  todayUKStr: string,
): (milestones: Array<{ id: string; name: string; code: string; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean; eventDateRequired: boolean }>) => MilestoneSideState {
  return (milestones) => {
    const next = milestones.find(
      (m) => !m.isComplete && !m.isNotRequired && m.isAvailable
        && !EXCHANGE_MILESTONES.has(m.code) && !EXCHANGE_GATES.has(m.code) && !COMPLETION_MILESTONES.has(m.code),
    );
    if (next) return { state: "hasNext", milestone: { id: next.id, name: next.name, code: next.code, eventDateRequired: next.eventDateRequired } };

    const hasGatePending = milestones.some((m) => !m.isComplete && !m.isNotRequired && EXCHANGE_GATES.has(m.code));
    if (hasGatePending) return { state: "gatePending", gateType: "exchange_gate" };

    const hasExchangePending = milestones.some((m) => !m.isComplete && !m.isNotRequired && EXCHANGE_MILESTONES.has(m.code));
    if (hasExchangePending) return { state: "gatePending", gateType: "post_exchange" };

    const completionMilestone = milestones.find(
      (m) => COMPLETION_MILESTONES.has(m.code) && !m.isComplete && !m.isNotRequired && m.isAvailable,
    );
    if (completionMilestone) {
      if (completionDate) {
        const cd = new Date(completionDate);
        if (toUKDateStr(cd) > todayUKStr) return { state: "completionPending", completionDate: cd };
      }
      return { state: "hasNext", milestone: { id: completionMilestone.id, name: completionMilestone.name, code: completionMilestone.code, eventDateRequired: completionMilestone.eventDateRequired } };
    }
    return { state: "allComplete" };
  };
}

export async function OverviewPanel({
  transaction,
  agencyId,
  isInternalStaff,
  isDirectorRole,
  currentUserId,
  currentUserName,
  recommendedFirms,
  isEllis = false,
}: Props) {
  // Pass 3c: pre-load the active round's createdAt so progress + risk
  // calculations can anchor on the active sale's start. Without this the
  // Overview right-rail reads "off track / 8 weeks elapsed" on a freshly-
  // relisted file (the Pass 3b page-level fix isn't enough — Overview
  // recomputes progress in this component using its own anchor).
  const activeRound = await prisma.propertyTransaction
    .findUnique({
      where: { id: transaction.id },
      select: { activeBuyerRound: { select: { createdAt: true } } },
    })
    .then((r) => r?.activeBuyerRound ?? null)
    .catch(() => null);
  const activeRoundCreatedAt = activeRound?.createdAt ?? null;
  const progressAnchor = activeRoundCreatedAt ?? transaction.createdAt;

  const [
    milestoneData,
    reminderLogs,
    activityEntries,
    automatedEmailCounts,
    lastContactedByContactId,
    brokerRow,
    currentUserNotifications,
  ] = await Promise.all([
    getMilestonesCached(transaction.id, agencyId).catch(() => null),
    getReminderLogsCached(transaction.id, agencyId).catch(() => []),
    getActivityTimelineCached(transaction.id, agencyId).catch(() => []),
    getAutomatedEmailCountsCached(transaction.id).catch(() => ({} as Record<string, number>)),
    getLastContactedByContactCached(transaction.id).catch(() => ({} as Record<string, string>)),

    prisma.propertyTransaction.findFirst({
      where: isInternalStaff ? { id: transaction.id } : { id: transaction.id, agencyId },
      select: {
        brokerFirmId: true,
        brokerContactId: true,
        brokerReferralFee: true,
        brokerReferralFeeReceived: true,
        purchaserBrokerReferral: true,
        brokerFirm: { select: { id: true, name: true } },
        brokerContact: { select: { id: true, name: true } },
      },
    }).catch(() => null),

    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { chainDeclineNotificationAddress: true, chainDeclineNotificationAt: true },
    }).catch(() => null),
  ]);

  // ── Progress + on-track signal (driven by milestones + holds) ──────────
  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];
  const completedMilestoneCodes = allMilestones.filter((m) => m.isComplete).map((m) => m.code);
  const allCompletions = allMilestones
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
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

  // ── Reminder summaries ─────────────────────────────────────────────────
  const now = new Date();
  const todayUKStr = toUKDateStr(now);
  const onHold = transaction.status === "on_hold";
  const actionableCount = onHold ? 0 : countActionable(reminderLogs, now);
  const overdueCount = onHold ? 0 : countOverdue(reminderLogs, now);
  const activeReminders = reminderLogs.filter((l) => l.status === "active");
  const topReminders = activeReminders.slice(0, 2).map((l) => ({
    id: l.id,
    ruleName: l.reminderRule.name,
    nextDueDate: l.nextDueDate,
    snoozedUntil: l.snoozedUntil ?? null,
    pendingChaseCount: l.chaseTasks.filter((t: { status: string }) => t.status === "pending").length,
  }));

  // NextActionCard input — top non-snoozed reminder + its earliest pending
  // chase task ID. The card falls back to the next milestone if no reminder
  // is active. Kept to a single call-to-action per file, not one per side.
  const topActiveReminder = activeReminders
    .filter((l) => !l.snoozedUntil || new Date(l.snoozedUntil) <= now)
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0] ?? null;
  const topPendingTaskId = topActiveReminder
    ? topActiveReminder.chaseTasks.find((t: { status: string }) => t.status === "pending")?.id ?? null
    : null;
  const nextActionReminder = topActiveReminder
    ? {
        ruleName: topActiveReminder.reminderRule.name,
        topTaskId: topPendingTaskId,
        nextDueDate: topActiveReminder.nextDueDate,
      }
    : null;

  // ── Next-step computation per side ─────────────────────────────────────
  const computeSideState = makeComputeMilestoneSideState(transaction.completionDate, todayUKStr);
  const vendorSideState: MilestoneSideState = milestoneData
    ? computeSideState(milestoneData.vendor)
    : { state: "allComplete" };
  const purchaserSideState: MilestoneSideState = milestoneData
    ? computeSideState(milestoneData.purchaser)
    : { state: "allComplete" };

  // ── Risk widget inputs ─────────────────────────────────────────────────
  const escalatedCount = reminderLogs.flatMap((l) =>
    l.chaseTasks.filter((t: { status: string; priority: string }) => t.status === "pending" && t.priority === "escalated"),
  ).length;
  const lastMilestoneCompletion = allMilestones
    .filter((m) => m.isComplete && m.completion?.completedAt)
    .sort((a, b) => new Date(b.completion!.completedAt!).getTime() - new Date(a.completion!.completedAt!).getTime())[0];
  const lastMilestoneCompletedAt = lastMilestoneCompletion?.completion?.completedAt ?? null;
  // Pass 3c: clamp "days stuck on milestone" forward to the active round's
  // createdAt. A relist IS progress on the file — the surviving vendor
  // VM completedAts pre-date the new sale and would otherwise read e.g.
  // "stuck 52 days" the instant the new buyer walks in. Ellis-locked
  // 2026-06-05 after the courtyard relist surfaced the leak.
  const stuckReference = lastMilestoneCompletedAt && activeRoundCreatedAt
    ? new Date(Math.max(new Date(lastMilestoneCompletedAt).getTime(), activeRoundCreatedAt.getTime()))
    : lastMilestoneCompletedAt;
  const daysStuckOnMilestone = stuckReference
    ? Math.floor((Date.now() - new Date(stuckReference).getTime()) / 86400000)
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

  // ── 6-stage summary strip (Overview restyle 2026-07-03) ────────────────
  const allMilestoneRows = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];
  const displayStages: MilestoneStage[] = resolveDisplayStages(allMilestoneRows, {
    expectedExchangeDate: transaction.expectedExchangeDate ?? null,
    overridePredictedDate: transaction.overridePredictedDate ?? null,
    targetCompletionDate: transaction.completionDate ?? null,
  });

  // ── Internal notes (filtered activity) ─────────────────────────────────
  const internalNotes = (activityEntries as ActivityEntry[])
    .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> =>
      e.kind === "comm" &&
      e.type === "internal_note" &&
      !(typeof e.content === "string" && e.content.includes("viewed their client portal")),
    )
    .map((e) => ({ id: e.id, content: e.content, createdAt: e.at, createdByName: e.createdByName }));

  return (
    <div className="space-y-5">
      {/* 6-stage summary strip - the file's headline read at a glance.
          Sits above the FileHealthBanner so the visual entry to the
          Overview tab is progress-first, not warnings-first. */}
      <div className="agent-glass" style={{ padding: "18px 22px" }}>
        <MilestoneTimelineStrip stages={displayStages} />
      </div>

      <FileHealthBanner actionableCount={actionableCount} overdueCount={overdueCount} onTrack={progress.onTrack} />

      {(transaction.status === "active" || transaction.status === "on_hold") && (
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
            .map((c) => [c.id, c.lastVisitedPortalAt as Date]),
        )}
        automatedEmailCounts={automatedEmailCounts}
        lastContactedByContactId={lastContactedByContactId}
      />

      {/* NextActionCard — highest-priority-thing-to-do tile. Vendor +
          purchaser NextMilestoneWidget replaced here 2026-07-03: the
          new card surfaces ONE call-to-action from the top reminder
          (or a milestone fallback), matching the mock. Detailed per-
          side next-milestone view still lives on the Steps tab. */}
      <NextActionCardConsumer
        transactionId={transaction.id}
        pathname={`/agent/transactions/${transaction.id}`}
        reminder={nextActionReminder}
        fallbackMilestone={
          vendorSideState.state === "hasNext"
            ? { name: vendorSideState.milestone.name, code: vendorSideState.milestone.code }
            : purchaserSideState.state === "hasNext"
              ? { name: purchaserSideState.milestone.name, code: purchaserSideState.milestone.code }
              : null
        }
      />

      <RemindersWidget reminders={topReminders} totalActive={actionableCount} />

      {/* Ellis-only AI summary card. Same gate as the header modal button
          at app/agent/transactions/[id]/page.tsx line 357-361. */}
      {isEllis && <AiSummaryCard transactionId={transaction.id} />}

      <RecentActivityWidget entries={activityEntries} />

      <Card id="chain-section" padding="none">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>Property chain</h3>
          <ViewChainButton
            transactionId={transaction.id}
            currentUserId={currentUserId}
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
      </Card>

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
      <TransactionNotes transactionId={transaction.id} initialNotes={internalNotes} currentUserName={currentUserName} />

      {/* isDirectorRole reserved for future director-only widgets in this tab. */}
      {isDirectorRole ? null : null}
    </div>
  );
}

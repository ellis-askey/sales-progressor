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
import { ContactsSection } from "@/components/contacts/ContactsSection";
import type { MilestoneSideState } from "@/components/transaction/NextMilestoneWidget";
import { NextActionCardConsumer } from "@/components/transaction/NextActionCardConsumer";
import { ActivityNotesCard } from "@/components/transaction/ActivityNotesCard";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { UninvitedNeighboursNote } from "@/components/chain/UninvitedNeighboursNote";
import { OnwardPurchaseCard } from "@/components/transaction/OnwardPurchaseCard";
import { getOnwardTrackerView, getOnwardSignalForFile, getRelatedSaleSignalForFile } from "@/lib/services/onward";
import { SolicitorSection } from "@/components/solicitors/SolicitorSection";
import { ClientOwnBrokerRow } from "@/components/transaction/ClientOwnBrokerRow";
import { PeoplePanel } from "@/components/transaction/PeoplePanel";
import { BrokerSection } from "@/components/transaction/BrokerSection";
import { RiskScoreWidget } from "@/components/transaction/RiskScoreWidget";
import { PropertyIntelCard } from "@/components/property/PropertyIntelCard";
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
  unsubscribedAt?: Date | null;
  isPrincipal?: boolean;
  portalEligible?: boolean;
};

type SolicitorContact = { id: string; name: string; phone: string | null; email: string | null; secondaryEmail?: string | null };
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
    whatsappGroupInviteUrl?: string | null;
    // Storage path (from the DB row). OverviewPanel signs a fresh URL
    // internally per render for the ContactsSection preview.
    photoStoragePath?: string | null;
    vendorSolicitorFirm?: SolicitorFirm | null;
    vendorSolicitorContact?: SolicitorContact | null;
    purchaserSolicitorFirm?: SolicitorFirm | null;
    purchaserSolicitorContact?: SolicitorContact | null;
  };
  agencyId: string;
  isInternalStaff: boolean;
  isDirectorRole: boolean;
  currentUserId: string;
  // Session role string — passed to the chain drawer so internal staff can edit
  // chains on outsourced files (the chain rule keys on the exact role, which
  // isInternalStaff can't stand in for: it excludes superadmin, includes viewer).
  currentUserRole?: string | null;
  currentUserName: string;
  currentUserImage?: string | null;
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
  currentUserRole,
  currentUserName,
  currentUserImage,
  recommendedFirms,
  isEllis = false,
}: Props) {
  // Pass 3c: pre-load the active round's createdAt so progress + risk
  // calculations can anchor on the active sale's start. Without this the
  // Overview right-rail reads "off track / 8 weeks elapsed" on a freshly-
  // relisted file (the Pass 3b page-level fix isn't enough — Overview
  // recomputes progress in this component using its own anchor).
  //
  // 2026-08-08 perf: activeRound + photo signed-URL moved INTO the
  // Promise.all below. Both used to await serially before the main fan-out
  // (activeRound = 1 DB round-trip; getSignedUrl = 1 Supabase Storage
  // network call). Neither controls flow into the fan-out; both results
  // are read only after the Promise.all resolves.
  const [
    activeRound,
    photoUrl,
    milestoneData,
    reminderLogs,
    activityEntries,
    automatedEmailCounts,
    lastContactedByContactId,
    brokerRow,
    currentUserNotifications,
  ] = await Promise.all([
    prisma.propertyTransaction
      .findUnique({
        where: { id: transaction.id },
        select: { activeBuyerRound: { select: { createdAt: true } } },
      })
      .then((r) => r?.activeBuyerRound ?? null)
      .catch(() => null),

    // Sign the property-photo URL per render for the ContactsSection preview.
    // Signed URLs expire after an hour; re-signing each render keeps the
    // preview reliable across long-lived tabs. Null if no photo uploaded.
    transaction.photoStoragePath
      ? import("@/lib/supabase-storage")
          .then(({ getSignedUrl }) => getSignedUrl(transaction.photoStoragePath!, 3600))
          .catch((err) => {
            console.warn("[OverviewPanel] failed to sign property-photo URL", err);
            return null as string | null;
          })
      : Promise.resolve(null as string | null),

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

  const activeRoundCreatedAt = activeRound?.createdAt ?? null;
  const progressAnchor = activeRoundCreatedAt ?? transaction.createdAt;

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

  // ── "Running late" slip warning (C1) ───────────────────────────────────
  // Fire only when the system predicts exchange more than two weeks past the
  // 12-week target, the estimate is trustworthy (past the onboarding phase),
  // and the file is still live (not on hold, not already exchanged/completed).
  // Name the current blocker: the earliest incomplete exchange-gating step that
  // is unlocked (waiting on someone), else the earliest incomplete one.
  const isExchangedOrDone = completedMilestoneCodes.some(
    (c) => c === "VM19" || c === "PM26" || c === "VM20" || c === "PM27",
  );
  const slipDays = progress.predictedExchangeDate && progress.twelveWeekTarget
    ? Math.round((new Date(progress.predictedExchangeDate).getTime() - new Date(progress.twelveWeekTarget).getTime()) / 86400000)
    : 0;
  const isSlipping =
    !progress.isEarlyEstimate && slipDays > 14 && transaction.status !== "on_hold" && !isExchangedOrDone;
  const slipBlocker = isSlipping
    ? (() => {
        const blockers = allMilestones
          .filter((m) => !m.isComplete && !m.isNotRequired && m.blocksExchange)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        return blockers.find((m) => m.isAvailable) ?? blockers[0] ?? null;
      })()
    : null;
  const slip = isSlipping && progress.predictedExchangeDate
    ? {
        predictedDateLabel: progress.predictedExchangeDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        bottleneckName: slipBlocker?.name ?? null,
      }
    : null;

  // ── Reminder summaries ─────────────────────────────────────────────────
  const now = new Date();
  const todayUKStr = toUKDateStr(now);
  const onHold = transaction.status === "on_hold";
  const actionableCount = onHold ? 0 : countActionable(reminderLogs, now);
  const overdueCount = onHold ? 0 : countOverdue(reminderLogs, now);
  const activeReminders = reminderLogs.filter((l) => l.status === "active");

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

  // "Up next" list for the merged card: the remaining active reminders (soonest
  // first), excluding the one already shown as the hero, so nothing repeats.
  const heroReminderId = topActiveReminder?.id ?? null;
  const otherReminders = [...activeReminders]
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .filter((l) => l.id !== heroReminderId)
    .slice(0, 3)
    .map((l) => ({ id: l.id, ruleName: l.reminderRule.name, nextDueDate: l.nextDueDate, snoozedUntil: l.snoozedUntil ?? null }));

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

  // Milestone strip moved to page level (Zone 4 - always visible, above
  // the tab content grid). See app/agent/transactions/[id]/page.tsx.

  // Onward-purchase + related-sale reported trackers. Scope is already enforced
  // by the page loading this transaction; the service is scope-agnostic by
  // contract. A file can carry BOTH: the seller's onward (the link above) and the
  // buyer's related sale (the link below).
  const onwardView = await getOnwardTrackerView(transaction.id);
  const onwardSignal = await getOnwardSignalForFile(transaction.id);
  const relatedView = await getOnwardTrackerView(transaction.id, "related_sale");
  const relatedSignal = await getRelatedSaleSignalForFile(transaction.id);

  // Client's own broker (portal-entered), shown in the Professionals tab beside
  // the solicitors. Both sides: purchaser for buyers, vendor for a seller's onward.
  const ownBrokerRows = await prisma.clientMoveInfo.findMany({
    where: { transactionId: transaction.id, ownBrokerName: { not: null } },
    select: { side: true, ownBrokerName: true, ownBrokerContactName: true, ownBrokerContact: true, ownBrokerAddedByName: true },
  });
  const ownBrokers = ownBrokerRows.map((r) => ({
    side: r.side as "vendor" | "purchaser",
    name: r.ownBrokerName!,
    contactName: r.ownBrokerContactName,
    contact: r.ownBrokerContact,
    addedByName: r.ownBrokerAddedByName,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FileHealthBanner transactionId={transaction.id} actionableCount={actionableCount} overdueCount={overdueCount} onTrack={progress.onTrack} slip={slip} />

      {/* People: Clients (contacts) + Professionals (solicitors) in one card
          with a header toggle, so the solicitor is one tap away. */}
      <PeoplePanel
        clients={
          <ContactsSection
            transactionId={transaction.id}
            contacts={transaction.contacts}
            isInternalStaff={isInternalStaff}
            address={transaction.propertyAddress}
            portalViewDates={Object.fromEntries(
              transaction.contacts
                .filter((c) => c.lastVisitedPortalAt)
                .map((c) => [c.id, c.lastVisitedPortalAt as Date]),
            )}
            automatedEmailCounts={automatedEmailCounts}
            lastContactedByContactId={lastContactedByContactId}
            whatsappGroupInviteUrl={transaction.whatsappGroupInviteUrl ?? null}
            photoUrl={photoUrl}
            embedded
          />
        }
        professionals={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
              embedded
            />
            <ClientOwnBrokerRow brokers={ownBrokers} />
          </div>
        }
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
        otherReminders={otherReminders}
        totalActive={actionableCount}
      />

      {/* Ellis-only AI summary card. Same gate as the header modal button
          at app/agent/transactions/[id]/page.tsx line 357-361. */}
      {isEllis && <AiSummaryCard transactionId={transaction.id} />}

      <ActivityNotesCard
        transactionId={transaction.id}
        entries={activityEntries}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
      />

      <Card id="chain-section" padding="none">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>Property chain</h3>
            <UninvitedNeighboursNote transactionId={transaction.id} />
          </div>
          <ViewChainButton
            transactionId={transaction.id}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
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

      <OnwardPurchaseCard
        transactionId={transaction.id}
        initialView={onwardView}
        signalActive={onwardSignal.buyingOnward}
        onwardAddress={onwardSignal.onwardAddress}
      />

      {/* Related sale: the buyer on this file is also selling (the link below).
          Shows only once there's a signal or an opened tracker, so it stays quiet
          on files where the buyer isn't selling. */}
      {(relatedView.exists || relatedSignal.selling) && (
        <OnwardPurchaseCard
          transactionId={transaction.id}
          initialView={relatedView}
          signalActive={relatedSignal.selling}
          onwardAddress={relatedSignal.relatedAddress}
          direction="related"
        />
      )}

      {/* Solicitors now live in the PeoplePanel "Professionals" tab above. */}

      {(brokerRow?.brokerFirmId || transaction.purchaseType === "mortgage") && (
        <BrokerSection
          transactionId={transaction.id}
          brokerFirmId={brokerRow?.brokerFirmId ?? null}
          brokerContactId={brokerRow?.brokerContactId ?? null}
          brokerFirmName={brokerRow?.brokerFirm?.name ?? null}
          brokerContactName={brokerRow?.brokerContact?.name ?? null}
          brokerReferralFee={brokerRow?.brokerReferralFee ?? null}
          brokerReferralFeeReceived={brokerRow?.brokerReferralFeeReceived ?? false}
          purchaserBrokerReferral={brokerRow?.purchaserBrokerReferral ?? false}
          purchaseType={transaction.purchaseType}
          canEdit={currentUserRole !== "sales_progressor"}
        />
      )}

      <RiskScoreWidget input={riskInput} />
      <PropertyIntelCard transactionId={transaction.id} />

      {/* Email + hold controls moved off the Overview tail into the
          hero's email-settings drawer (EmailSettingsDrawer, 2026-08-11
          feedback item 1) — one home, per-contact pausing included. */}

      {/* isDirectorRole reserved for future director-only widgets in this tab. */}
      {isDirectorRole ? null : null}
    </div>
  );
}

// Async server component for the file-detail sidebar (TransactionSidebar).
// Fetches the milestone-derived progress + a small fan-out of secondary
// queries (broker row, file-time sessions, assigned user, agent user,
// recommended firms) and hands them to TransactionSidebar.
//
// Mounted under <Suspense> by the page shell so the header paints
// immediately and the sidebar streams in over the next moment.
//
// All shared fetchers go through React.cache() so when the Overview
// panel, the Steps panel, etc. also ask for milestones, only ONE
// underlying query runs per request.

import { prisma } from "@/lib/prisma";
import { getMilestonesCached } from "@/lib/services/cached-fetchers";
import { calculateProgress, computeEffectiveStartDate, detectPhase } from "@/lib/services/fees";
import { totalHoldMs } from "@/lib/services/hold-duration";
import { TransactionSidebar } from "@/components/transaction/TransactionSidebar";
import type { ClientType, PurchaseType, Tenure, TransactionStatus } from "@prisma/client";

type SidebarTransaction = {
  id: string;
  propertyAddress: string;
  purchasePrice: number | null;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  status: TransactionStatus;
  chainLinkId?: string | null;
  overridePredictedDate: Date | null;
  completionDate: Date | null;
  createdAt: Date;
  serviceType: "self_managed" | "outsourced" | null;
  freeOnExchange?: boolean | null;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  referralFee?: number | null;
  referredFirmId?: string | null;
  referredFirm?: { name: string } | null;
  agentUserId?: string | null;
  assignedUserId?: string | null;
  agencyId: string;
  agency?: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null;
  holdPeriods: Array<{ startedAt: Date; endedAt: Date | null }>;
};

type Props = {
  transaction: SidebarTransaction;
  isInternalStaff: boolean;
  isInternal: boolean;
  isDirectorRole: boolean;
  isProgressor: boolean;
  isAdminRole: boolean;
  isAgentRole: boolean;
  agencyId: string;
  // Slot rendered at the bottom of the Agent card. Used by the page to
  // inject the director-only ReassignOwnerControl. SidebarPanel is
  // oblivious to what's in it — just forwards to TransactionSidebar.
  agentSlot?: React.ReactNode;
};

const INTERNAL_ROLES = ["superadmin", "admin", "sales_progressor"] as const;

export async function SidebarPanel({
  transaction,
  isInternalStaff,
  isInternal,
  isDirectorRole,
  isProgressor,
  isAdminRole,
  isAgentRole,
  agencyId,
  agentSlot,
}: Props) {
  // Pass 3c reverts B5: time-on-file stays universal across the whole file's
  // lifetime, not per-sale. Ellis-locked 2026-06-05 after the courtyard
  // relist surfaced the mistake — "nothing time-on-file-related should
  // change" at relist. The activeRound.createdAt fetch is still needed
  // below for the progress anchor (B3 file-detail), so kept the fetch but
  // dropped the FileTimeSession scope filter.
  const activeRound = await prisma.propertyTransaction
    .findUnique({
      where: { id: transaction.id },
      select: { activeBuyerRound: { select: { createdAt: true } } },
    })
    .then((r) => r?.activeBuyerRound ?? null)
    .catch(() => null);
  const activeRoundCreatedAt = activeRound?.createdAt ?? null;

  const [milestoneData, brokerRow, fileTimeSessions, assignedUser, agentUser, recommendedFirms] = await Promise.all([
    getMilestonesCached(transaction.id, agencyId).catch(() => null),

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

    prisma.fileTimeSession.findMany({
      where: { transactionId: transaction.id },
      select: {
        totalEngagedSeconds: true,
        lastActivityAt: true,
        endedAt: true,
        user: { select: { role: true } },
      },
    }).catch(() => []),

    transaction.assignedUserId
      ? prisma.user.findUnique({
          where: { id: transaction.assignedUserId },
          select: { clientType: true, legacyFee: true },
        })
      : Promise.resolve(null),

    transaction.agentUserId
      ? prisma.user.findUnique({
          where: { id: transaction.agentUserId },
          select: { id: true, name: true, email: true, firmName: true },
        })
      : Promise.resolve(null),

    isDirectorRole
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (prisma as any).agencyRecommendedSolicitor.findMany({
          where: { agencyId },
          orderBy: { solicitorFirm: { name: "asc" } },
          select: { solicitorFirmId: true, defaultReferralFeePence: true, solicitorFirm: { select: { name: true } } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).then((rows: any[]) => rows.map((r) => ({
          id: r.solicitorFirmId as string,
          name: r.solicitorFirm.name as string,
          defaultReferralFeePence: r.defaultReferralFeePence as number | null,
        })))
      : Promise.resolve(null as Array<{ id: string; name: string; defaultReferralFeePence: number | null }> | null),
  ]);

  // ── Progress + key dates (milestone-driven) ────────────────────────────
  const allMilestones = [
    ...(milestoneData?.vendor ?? []),
    ...(milestoneData?.purchaser ?? []),
  ];

  const completedMilestoneCodes = allMilestones.filter((m) => m.isComplete).map((m) => m.code);

  const allCompletions = allMilestones
    .map((m) => m.completion)
    .filter((c): c is NonNullable<typeof c> => c != null);
  // Pass 3b: anchor "weeks elapsed" / "off track" on the active sale's
  // start so the right-rail progress pill on a relisted file resets at
  // relist instead of inheriting the 8-week-old file createdAt. Reused
  // from B5's activeRoundCreatedAt fetch above.
  const progressAnchor = activeRoundCreatedAt ?? transaction.createdAt;
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

  const exchangeConfirmed = allMilestones.some(
    (m) => (m.code === "VM19" || m.code === "PM26") && m.isComplete,
  );

  const keyDates = allMilestones
    .filter((m) => m.eventDateRequired && m.completion?.eventDate)
    .map((m) => ({ name: m.name, eventDate: m.completion!.eventDate as Date }))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  // ── File-time tracker ──────────────────────────────────────────────────
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
    (s) => s.endedAt === null && new Date(s.lastActivityAt) > liveCutoff,
  );
  const fileTime = {
    agentSeconds,
    teamSeconds,
    totalSeconds: agentSeconds + teamSeconds,
    lastActiveAt: mostRecentActivity,
    hasLiveSession,
  };

  return (
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
        agentFeePercent: transaction.agentFeePercent ?? null,
        agentFeeIsVatInclusive: transaction.agentFeeIsVatInclusive ?? null,
        referralFee: transaction.referralFee ?? null,
        referredFirmName: transaction.referredFirm?.name ?? null,
        referredFirmId: transaction.referredFirmId ?? null,
        brokerReferralFee: brokerRow?.brokerReferralFee ?? null,
        brokerFirmName: brokerRow?.brokerFirm?.name ?? null,
        serviceType: transaction.serviceType ?? null,
        freeOnExchange: transaction.freeOnExchange ?? null,
      }}
      recommendedFirms={recommendedFirms}
      showOurFee={isDirectorRole || isAdminRole}
      assignedUser={assignedUser}
      agencyFeeOverride={transaction.agency ? { feeTier: transaction.agency.feeTier, legacyOutsourcedFeePence: transaction.agency.legacyOutsourcedFeePence } : null}
      agentUser={agentUser}
      progress={progress}
      keyDates={keyDates}
      exchangeConfirmed={exchangeConfirmed}
      fileTime={fileTime}
      isInternal={isInternal}
      hideCommercialFields={isProgressor && !isAdminRole}
      agentSlot={agentSlot}
    />
  );
  // isAgentRole reserved for future progress-tooltip variants; explicit
  // mention here keeps it from being flagged as an unused prop by TS.
  void isAgentRole;
}

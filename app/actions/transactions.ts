"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { createTransaction } from "@/lib/services/transactions";
import { CURRENT_PRICING_VERSION } from "@/lib/billing/pricing-version";
import { createChainV2 } from "@/lib/services/chains";
import { sendChainInvite } from "@/lib/chain/invite";
import { evaluateTransactionReminders, createInitialRemindersInline } from "@/lib/services/reminders";
import { completeMilestone, initializeMilestoneCompletions, maybeUnlockExchangeGate } from "@/lib/services/milestones";
import { logActivity } from "@/lib/services/activity";
import { postExchangeDateUpdateToClients } from "@/lib/services/portal";
import { sendCompletionSurveys } from "@/lib/services/survey";
import { cascadeChainWithdrawal, cascadeChainBuyerFound } from "@/lib/chain/withdrawal";
import { splitChainAtBoundary } from "@/lib/chain/split";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { computeAutoNrCodes, PURCHASE_TYPE_NR_CODES, FREEHOLD_NR_CODES } from "@/lib/milestone-auto-nr";
import { pushFileAssigned } from "@/lib/agent/push-events";
import { normaliseAddressString } from "@/lib/utils/address";
import { findFirstPairwiseConflict } from "@/lib/contacts/dedupe";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import type { TransactionStatus, PurchaseType, Tenure, ContactRole, MilestoneSide, WithdrawalReason, ChainDirection } from "@prisma/client";
import { Prisma } from "@prisma/client";

type ContactInput = { name: string; phone?: string; email?: string; roleType: ContactRole };

const CHAIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Closed-loop chain arc (2026-06-05) — direction-cascade rules locked in by
// the spec. Each WithdrawalReason picks which way the LOST_BUYER /
// LOST_PURCHASE cascade walks AND which side detaches as an orphan chain.
//
//   BUYER_WITHDREW       → upward cascade, downstream detaches
//   SELLER_WITHDREW      → downward cascade, upstream detaches
//   CHAIN_COLLAPSE_ABOVE → no cascade (upstream already cascading), downstream detaches
//   OTHER                → both directions cascade, neither side detaches
const CHAIN_CASCADE_RULES: Record<WithdrawalReason, {
  cascadeDirections: ChainDirection[];
  orphanDirection: ChainDirection | null;
}> = {
  BUYER_WITHDREW:       { cascadeDirections: ["UPWARD"],             orphanDirection: "DOWNWARD" },
  SELLER_WITHDREW:      { cascadeDirections: ["DOWNWARD"],           orphanDirection: "UPWARD"   },
  CHAIN_COLLAPSE_ABOVE: { cascadeDirections: [],                     orphanDirection: "DOWNWARD" },
  OTHER:                { cascadeDirections: ["UPWARD", "DOWNWARD"], orphanDirection: null       },
};

// Build the per-round chain snapshot persisted to BuyerRound.chainSnapshot
// at the moment of withdraw. Captures the chain shape as it stood when the
// agent clicked Confirm — neighbours, current withdrawal statuses, claim
// state. Open notifications are NOT captured here (the queue is the source
// of truth for those, and the drawer queries it directly at render time).
// The detachedSegment field is added later by the post-commit split path.
async function buildChainSnapshotForWithdrawal(
  chainLinkId: string,
  reason: WithdrawalReason | null,
): Promise<Prisma.InputJsonValue> {
  const link = await prisma.chainLink.findUnique({
    where: { id: chainLinkId },
    select: { id: true, chainId: true, position: true },
  });
  if (!link) return { error: "link_not_found" } as Prisma.InputJsonValue;

  const neighbours = await prisma.chainLink.findMany({
    where: { chainId: link.chainId },
    select: {
      id: true,
      position: true,
      withdrawalStatus: true,
      claimedByUserId: true,
      claimedBy: { select: { name: true, email: true, agency: { select: { name: true } } } },
      transactionId: true,
      transaction: { select: { propertyAddress: true } },
      stubPropertyAddress: true,
      stubAgencyName: true,
      stubAgentName: true,
    },
    orderBy: { position: "asc" },
  });

  return {
    chainId: link.chainId,
    ourLinkId: link.id,
    ourPosition: link.position,
    withdrawalReason: reason,
    capturedAt: new Date().toISOString(),
    neighbours: neighbours.map((n) => ({
      linkId: n.id,
      position: n.position,
      withdrawalStatus: n.withdrawalStatus,
      claimedByUserId: n.claimedByUserId,
      claimedAgentName: n.claimedBy?.name ?? null,
      claimedAgencyName: n.claimedBy?.agency?.name ?? null,
      claimedTransactionId: n.transactionId,
      claimedAddress: n.transaction?.propertyAddress ?? null,
      stubAddress: n.stubPropertyAddress,
      stubAgencyName: n.stubAgencyName,
      stubAgentName: n.stubAgentName,
    })),
    detachedSegment: null as { chainId: string; splitAt: string } | null,
  } as Prisma.InputJsonValue;
}

export async function createTransactionAction(input: {
  propertyAddress: string;
  purchasePrice: number | null;
  tenure: Tenure | null;
  isShareOfFreehold?: boolean;
  purchaseType: PurchaseType | null;
  notes: string | null;
  progressedBy: "progressor" | "agent";
  contacts: ContactInput[];
  vendorSolicitorFirmId: string | null;
  vendorSolicitorContactId: string | null;
  purchaserSolicitorFirmId: string | null;
  purchaserSolicitorContactId: string | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  agentFeeIsVatInclusive?: boolean | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
  brokerFirmId?: string | null;
  brokerContactId?: string | null;
  brokerReferralFee?: number | null;
  purchaserBrokerReferral?: boolean;
  photoStoragePath?: string | null;
  mosUploaded?: boolean;
  mosStoragePath?: string;
  mosFileSize?: number;
  mosMimeType?: string;
  mosFilename?: string;
  forceCreate?: boolean;
  // Admin-only migration overrides. createdAt backdates the file; agencyId
  // + assignedUserId let admin create FOR a different agency / progressor;
  // agentUserId attributes the file to the real director/negotiator who owned
  // it in the old system. Action throws Forbidden if any is set by a non-admin.
  migrationCreatedAt?: Date;
  migrationAgencyId?: string;
  migrationAssignedUserId?: string;
  migrationAgentUserId?: string;
  // Director-only: when set, the new file is owned by this agency user
  // instead of the creating director. Validated server-side: must be a
  // director or negotiator in the SAME agency. Negotiators submitting
  // this field are rejected — a negotiator can only create files in their
  // own name. Ignored entirely on non-self-managed flows (the field has
  // no meaning when an internal progressor will own the file).
  assignToUserId?: string;
  chain?: {
    stubs: Array<{
      direction: "above" | "below";
      stubPropertyAddress: string;
      stubAgencyName: string;
      stubAgentName: string;
      stubAgentEmail: string;
      stubAgentPhone: string;
      stubNotes: string;
    }>;
    sendInvites: boolean;
  };
}) {
  const session = await requireSession();
  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
  const isAdmin = hasAdminPowers(session);
  const resolvedProgressedBy = isAgent ? input.progressedBy : "progressor";

  // Admin-only migration overrides. Block any non-admin from passing them.
  const hasMigrationOverride = !!(input.migrationCreatedAt || input.migrationAgencyId || input.migrationAssignedUserId || input.migrationAgentUserId);
  if (hasMigrationOverride && !isAdmin) {
    throw new Error("Forbidden: migration overrides require admin role");
  }
  const effectiveAgencyId = input.migrationAgencyId ?? session.user.agencyId;
  if (!effectiveAgencyId) {
    throw new Error("Cannot create transaction without an agency");
  }
  const effectiveAssignedUserId = input.migrationAssignedUserId ?? (isAgent ? undefined : session.user.id);

  // Director-only assignment: validate the picked user is a director or
  // negotiator in the SAME agency and override the file owner. Negotiators
  // can't use this — silently ignore if a negotiator submits the field
  // (defence-in-depth; the form shouldn't render the picker for them).
  let effectiveAgentUserId: string | null = input.migrationAgentUserId ?? (isAgent ? session.user.id : null);
  if (input.assignToUserId && session.user.role === "director") {
    const target = await prisma.user.findUnique({
      where: { id: input.assignToUserId },
      select: { id: true, agencyId: true, role: true },
    });
    if (!target || target.agencyId !== effectiveAgencyId) {
      throw new Error("Cannot assign to a user outside your agency");
    }
    if (target.role !== "director" && target.role !== "negotiator") {
      throw new Error("Cannot assign to a non-agent user");
    }
    effectiveAgentUserId = target.id;
  }

  // Duplicate address guard: normalise and check within agency for active files.
  // Scope the check to the EFFECTIVE agency (admin migration may target a
  // different agency than the admin's own — admin's own agencyId is null anyway).
  if (effectiveAgencyId) {
    const normAddress = input.propertyAddress.toLowerCase().replace(/\s+/g, " ").trim();
    const allActive = await prisma.propertyTransaction.findMany({
      where: { agencyId: effectiveAgencyId, status: { in: ["active", "on_hold"] } },
      select: { id: true, propertyAddress: true, agentUser: { select: { name: true } } },
    });
    const duplicate = allActive.find(
      (t) => t.propertyAddress.toLowerCase().replace(/\s+/g, " ").trim() === normAddress
    );
    if (duplicate && !input.forceCreate) {
      throw Object.assign(
        new Error("DUPLICATE_ADDRESS"),
        {
          duplicateId: duplicate.id,
          assignedTo: duplicate.agentUser?.name ?? null,
        }
      );
    }
  }

  // Normalise the postcode portion ("bs1 4pn" → "BS1 4PN") at the server
  // boundary so the DB, all downstream emails (chain invite etc.), and
  // the file sidebar all read canonical UK postcode form. Street + city
  // segments untouched. Same helper applied at the chain-link POST route
  // so every property-address write goes through identical normalisation.
  const normalisedAddress = normaliseAddressString(input.propertyAddress);

  const tx = await createTransaction({
    propertyAddress: normalisedAddress,
    agencyId: effectiveAgencyId,
    assignedUserId: effectiveAssignedUserId,
    agentUserId: effectiveAgentUserId,
    createdAt: input.migrationCreatedAt,
    progressedBy: resolvedProgressedBy,
    purchasePrice: input.purchasePrice,
    tenure: input.tenure,
    isShareOfFreehold: input.tenure === "leasehold" ? (input.isShareOfFreehold ?? false) : false,
    purchaseType: input.purchaseType,
    notes: input.notes,
    vendorSolicitorFirmId: input.vendorSolicitorFirmId,
    vendorSolicitorContactId: input.vendorSolicitorContactId,
    purchaserSolicitorFirmId: input.purchaserSolicitorFirmId,
    purchaserSolicitorContactId: input.purchaserSolicitorContactId,
    agentFeeAmount: input.agentFeeAmount ?? null,
    agentFeePercent: input.agentFeePercent ?? null,
    agentFeeIsVatInclusive: input.agentFeeIsVatInclusive ?? null,
    referredFirmId: input.referredFirmId ?? null,
    referralFee: input.referralFee ?? null,
    brokerFirmId: input.brokerFirmId ?? null,
    brokerContactId: input.brokerContactId ?? null,
    brokerReferralFee: input.brokerReferralFee ?? null,
    purchaserBrokerReferral: input.purchaserBrokerReferral ?? false,
    photoStoragePath: input.photoStoragePath ?? null,
    isMigrated: hasMigrationOverride,
  });

  if (input.contacts.length > 0) {
    // Reject the batch if two contacts on the same file share a phone or
    // email. Same structured-error pattern as DUPLICATE_ADDRESS above —
    // NewSaleFlow catches by message string and surfaces inline.
    const conflict = findFirstPairwiseConflict(input.contacts);
    if (conflict) {
      throw Object.assign(new Error("DUPLICATE_CONTACT_FIELD"), {
        kind: conflict.kind,
        offenderIndex: conflict.offenderIndex,
        withName: conflict.withName,
      });
    }
    await prisma.contact.createMany({
      data: input.contacts.map((c) => ({
        propertyTransactionId: tx.id,
        name: c.name.trim(),
        phone: c.phone?.trim() || null,
        email: c.email?.trim() || null,
        roleType: c.roleType,
        portalToken: randomUUID(),
        // Phase 1 commit 3: purchaser contacts are scoped to the active
        // round; vendor / solicitor / broker contacts stay file-level.
        // Same attribution rule as Phase 0 backfill.
        buyerRoundId: c.roleType === "purchaser" ? tx.activeBuyerRoundId : null,
      })),
    });
  }

  // Initialize all milestone completions (available/locked/not_required per tenure+purchaseType)
  if (input.tenure && input.purchaseType) {
    await initializeMilestoneCompletions(tx.id, input.tenure, input.purchaseType, session.user.id, tx.activeBuyerRoundId);
  }

  // If a MOS document was uploaded during form creation, auto-confirm MOS received for both sides
  let mosAutoConfirmed = false;
  if (input.mosUploaded) {
    const mosDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM2", "PM2"] } },
      select: { id: true },
    });
    const mosConfirmer = { kind: "user" as const, id: session.user.id, name: session.user.name ?? "" };
    await Promise.all(
      mosDefs.map((def) =>
        completeMilestone({
          transactionId: tx.id,
          milestoneDefinitionId: def.id,
          confirmer: mosConfirmer,
        })
      )
    );
    mosAutoConfirmed = true;
  }

  // Store MOS document if it was uploaded during form creation
  if (input.mosStoragePath && input.mosFileSize && input.mosMimeType) {
    await prisma.transactionDocument.create({
      data: {
        transactionId: tx.id,
        filename: input.mosFilename ?? "Memorandum of Sale",
        storagePath: input.mosStoragePath,
        fileSize: input.mosFileSize,
        mimeType: input.mosMimeType,
        source: "mos",
      },
    }).catch(console.error);
  }

  // Fast inline creation: batch creates logs + tasks synchronously (~3 queries).
  // Phase 1 commit 3: purchaser-side ReminderLog/ChaseTask rows get the
  // active round stamp; vendor-side stay file-level.
  const completedCodes = mosAutoConfirmed ? ["VM2", "PM2"] : [];
  await createInitialRemindersInline(tx.id, tx.createdAt, tx.assignedUserId, completedCodes, tx.activeBuyerRoundId).catch(console.error);
  // Full engine handles anchor-based and exchange-gated rules asynchronously
  void evaluateTransactionReminders(tx.id).catch(console.error);

  // White-labelled "Getting your sale moving" intro to buyer + seller —
  // fires once per contact on outsourced sales only. Fire-and-forget so a
  // queue / DB hiccup doesn't fail the new-sale response. The orchestrator
  // gates on serviceType internally too as a belt-and-braces check, but
  // the trigger guard here keeps the call path narrow.
  if (resolvedProgressedBy === "progressor") {
    const { sendOutsourceIntroForTransaction } = await import("@/lib/emails/send-outsource-intro");
    void sendOutsourceIntroForTransaction(tx.id, session.user.id).catch(console.error);
  }

  // Chain creation — runs after transaction is fully committed; failure is non-fatal
  let chainFailed = false;
  if (input.chain && input.chain.stubs.length > 0) {
    try {
      const createdChain = await createChainV2({
        transactionId: tx.id,
        agencyId: session.user.agencyId ?? "",
        userId: session.user.id,
        stubs: input.chain.stubs.map((s) => ({
          direction: s.direction,
          stubPropertyAddress: normaliseAddressString(s.stubPropertyAddress),
          stubAgencyName: s.stubAgencyName,
          stubAgentEmail: s.stubAgentEmail || null,
          stubAgentName: s.stubAgentName || null,
          stubAgentPhone: s.stubAgentPhone || null,
          stubNotes: s.stubNotes || null,
        })),
      });

      if (input.chain.sendInvites) {
        const invitableLinks = createdChain.links.filter(
          (l) =>
            l.transactionId === null &&
            l.stubAgentEmail &&
            CHAIN_EMAIL_RE.test(l.stubAgentEmail),
        );
        for (const link of invitableLinks) {
          await sendChainInvite({
            link: {
              id: link.id,
              stubAgentEmail: link.stubAgentEmail,
              stubAgentName: link.stubAgentName,
              stubPropertyAddress: link.stubPropertyAddress,
              stubAgencyName: link.stubAgencyName,
              inviteStatus: link.inviteStatus,
              inviteResendCount: 0,
              chain: {
                createdByUserId: createdChain.createdByUserId,
                links: createdChain.links.map((l) => ({
                  position: l.position,
                  transactionId: l.transactionId,
                  transaction: l.transaction
                    ? { propertyAddress: l.transaction.propertyAddress }
                    : null,
                  stubPropertyAddress: l.stubPropertyAddress,
                })),
              },
            },
            sentByUserId: session.user.id,
            sentByName: session.user.name ?? "",
          });
        }
      }
    } catch (err) {
      console.error("Chain creation failed:", err);
      chainFailed = true;
    }
  }

  // Sale-setup notes → the file's Notes feed (2026-08-19). The new-sale
  // form's notes box stored into PropertyTransaction.notes, a column no
  // screen reads, so the agent's setup notes silently vanished (founder
  // report). Writing them as a normal internal note puts them in the
  // Overview Notes card for both the agency and the internal team, where
  // they can be managed like any other note. The column keeps its value
  // as the raw record.
  if (input.notes?.trim()) {
    await prisma.outboundMessage.create({
      data: {
        transactionId: tx.id,
        agencyId: effectiveAgencyId,
        type: "internal_note",
        // "Setup note" is the marker the Notes card pins on.
        subject: "Setup note",
        contactIds: [],
        content: input.notes.trim(),
        createdById: session.user.id,
        createdByRole: session.user.role,
      },
    }).catch((err) => console.error("Sale-setup note write failed:", err));
  }

  revalidatePath("/transactions");
  revalidatePath("/agent/transactions");
  revalidatePath("/dashboard");

  return { id: tx.id, mosAutoConfirmed, chainFailed };
}

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

export async function saveCompletionDateAction(transactionId: string, completionDate: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { completionDate: completionDate ? new Date(completionDate) : null },
  });

  const dateStr = completionDate
    ? new Date(completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  await logActivity(
    transactionId,
    dateStr
      ? `${session.user.name} set completion date to ${dateStr}`
      : `${session.user.name} cleared completion date`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function changeStatusAction(
  transactionId: string,
  status: TransactionStatus,
  fallThroughReason?: string | null,
  // When status === "on_hold", the optional return date the user expects
  // to come back to this file. NULL = indefinite (no auto-surface). Used
  // by the hub's expired-holds card.
  plannedEndAt?: Date | string | null,
  // Closed-loop chain arc (2026-06-05). Required when status === "withdrawn"
  // and the file has a chainLinkId — drives cascade direction in
  // cascadeChainWithdrawal and orphan-segment detachment in
  // splitChainAtBoundary. Caller (StatusControl) collects via the
  // structured radio picker in the withdraw modal.
  withdrawalReason: WithdrawalReason | null = null,
  // When status === "on_hold", the optional free-text "why" captured in the
  // hold modal. Stored on the TransactionHoldPeriod row and surfaced by the
  // hub's holds-needing-attention card.
  holdReason: string | null = null,
) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      status: true,
      chainLinkId: true,
      activeBuyerRoundId: true,
      agencyId: true,
    },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.status === status) return;

  // Gate: completing a transaction requires exchange + legal completion milestones confirmed
  if (status === "completed") {
    const exchangeCodes = ["VM19", "PM26"];
    const completionCodes = ["VM20", "PM27"];
    const gateDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: [...exchangeCodes, ...completionCodes] } },
      select: { id: true, code: true },
    });
    const gateDefIds = gateDefs.map((d) => d.id);
    // Round-scoped status-flip gate check — VM19/PM26/VM20/PM27 codes;
    // forRound's OR picks vendor file-level OR active-round purchaser.
    const statusGateTx = await prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { activeBuyerRoundId: true },
    });
    const statusGateScope = forRound(statusGateTx?.activeBuyerRoundId ?? null, transactionId);
    const gateCompletions = await prisma.milestoneCompletion.findMany({
      where: {
        transactionId,
        milestoneDefinitionId: { in: gateDefIds },
        state: "complete",
        ...milestoneScopeWhere(statusGateScope),
      },
      select: { milestoneDefinitionId: true },
    });
    const completedDefIds = new Set(gateCompletions.map((c) => c.milestoneDefinitionId));
    const hasExchanged = gateDefs.some((d) => exchangeCodes.includes(d.code) && completedDefIds.has(d.id));
    const hasLegalCompletion = gateDefs.some((d) => completionCodes.includes(d.code) && completedDefIds.has(d.id));

    if (!hasExchanged || !hasLegalCompletion) {
      throw new Error(
        "Cannot mark as completed before confirming exchange and legal completion milestones. " +
        "Please confirm those milestones on the file first."
      );
    }
  }

  // Hold-period lifecycle:
  //   - When entering on_hold from any status: open a new TransactionHoldPeriod
  //     row with the optional plannedEndAt. The hold-duration helpers, the
  //     hub's expired-holds card, and the median-time calculations all need
  //     this row to exist while status=on_hold.
  //   - When leaving on_hold (to active/completed/withdrawn): close the
  //     currently-open period (endedAt = now). updateMany handles the
  //     defensive case of multiple open periods.
  const enteringHold = status === "on_hold" && tx.status !== "on_hold";
  const leavingHold  = tx.status === "on_hold" && status !== "on_hold";
  const plannedEndAtDate: Date | null = plannedEndAt
    ? (plannedEndAt instanceof Date ? plannedEndAt : new Date(plannedEndAt))
    : null;

  // Phase-2 PR 1 (fall-through cancellation): when the status flips to
  // withdrawn, mirror what relistTransactionImpl already does at relist time
  // — cancel open buyer-side PM ReminderLogs + ChaseTasks for the active
  // round, AND close any open TransactionHoldPeriods. Mirrored here so the
  // withdraw-no-relist path is also covered (Ellis can withdraw and never
  // relist — open chases were previously firing at the dead buyer forever).
  // Idempotent via the status / endedAt guards: re-running on already-
  // cancelled / already-closed rows is a no-op.
  //
  // Semantics locked by the Phase-2 plan: status="cancelled",
  // statusReason="sale fell through".
  type CancellationSummary = {
    buyerRoundId: string;
    cancelledLogIds: string[];
    cancelledChaseIds: string[];
    cancelledClientChaseStateCount: number;
    holdsClosed: number;
  };

  // Closed-loop chain arc (2026-06-05): build the chainSnapshot BEFORE the
  // $transaction opens, so we capture the chain shape as it stood at the
  // moment of the withdraw click (before any link state mutates). The
  // snapshot is persisted onto the active BuyerRound inside the
  // transaction. Only built when status === "withdrawn" AND the file has
  // a chainLinkId — there's nothing chain-shaped to snapshot otherwise.
  let chainSnapshotForRound: Prisma.InputJsonValue | null = null;
  if (status === "withdrawn" && tx.chainLinkId) {
    chainSnapshotForRound = await buildChainSnapshotForWithdrawal(
      tx.chainLinkId,
      withdrawalReason,
    );
  }

  const cancellationSummary = await prisma.$transaction(async (ptx): Promise<CancellationSummary | null> => {
    await ptx.propertyTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        fallThroughReason: status === "withdrawn" ? (fallThroughReason ?? null) : null,
        // Structured withdrawal classification (closed-loop arc 2026-06-05).
        // Nulled on any non-withdrawn status change so a previously-
        // withdrawn-then-relisted-then-paused file doesn't carry a stale
        // reason forward.
        withdrawalReason: status === "withdrawn" ? withdrawalReason : null,
      },
    });

    // Enquiries rework: keep the enquiries tracker honest across status changes.
    //   - Terminal (withdrawn / completed): close the loop for good, so its
    //     chase can never fire again and it stops counting as "open" anywhere.
    //   - Returning to active from a hold: restart the chase clock so the weeks
    //     paused don't trigger an instant "stalled" escalation on day one back.
    //   - Entering on_hold: no change needed — the chase cron already skips
    //     non-active files; the loop resumes cleanly when the file reactivates.
    if (status === "withdrawn" || status === "completed") {
      await ptx.enquiryTracker.updateMany({
        where: { transactionId, closedAt: null },
        data: { closedAt: new Date() },
      });
      await ptx.enquiryRaiseChase.updateMany({
        where: { transactionId, closedAt: null },
        data: { closedAt: new Date() },
      });
    } else if (leavingHold && status === "active") {
      await ptx.enquiryTracker.updateMany({
        where: { transactionId, closedAt: null },
        data: { lastChasedAt: new Date(), escalatedAt: null },
      });
      await ptx.enquiryRaiseChase.updateMany({
        where: { transactionId, closedAt: null },
        data: { lastNudgedAt: new Date(), escalatedAt: null },
      });
    }

    // Persist the chain snapshot to the active BuyerRound. The round
    // stays "active" until the file is relisted (at which point the
    // existing STEP 1 archive logic carries the snapshot into the drawer).
    // If the file is withdrawn but never relisted, the snapshot still
    // sits on the round for any future drawer / audit access.
    if (chainSnapshotForRound !== null && tx.activeBuyerRoundId) {
      await ptx.buyerRound.update({
        where: { id: tx.activeBuyerRoundId },
        data: { chainSnapshot: chainSnapshotForRound },
      });
    }
    if (enteringHold) {
      await ptx.transactionHoldPeriod.create({
        data: {
          transactionId,
          startedAt: new Date(),
          startedById: session.user.id,
          plannedEndAt: plannedEndAtDate,
          reason: holdReason?.trim() ? holdReason.trim().slice(0, 500) : null,
        },
      });
    }
    if (leavingHold) {
      await ptx.transactionHoldPeriod.updateMany({
        where: { transactionId, endedAt: null },
        data: { endedAt: new Date(), endedById: session.user.id },
      });
    }
    if (status === "withdrawn" && tx.activeBuyerRoundId) {
      // 1. Cancel PM-targeted active ReminderLogs for the active buyer round.
      const logs = await ptx.reminderLog.findMany({
        where: {
          transactionId,
          buyerRoundId: tx.activeBuyerRoundId,
          status: "active",
          reminderRule: { targetMilestoneCode: { startsWith: "PM" } },
        },
        select: { id: true },
      });
      const cancelledLogIds = logs.map((l) => l.id);
      if (cancelledLogIds.length > 0) {
        await ptx.reminderLog.updateMany({
          where: { id: { in: cancelledLogIds } },
          data: { status: "cancelled", statusReason: "sale fell through" },
        });
      }
      // 2. Cancel pending ChaseTasks under those logs.
      let cancelledChaseIds: string[] = [];
      if (cancelledLogIds.length > 0) {
        const tasks = await ptx.chaseTask.findMany({
          where: { reminderLogId: { in: cancelledLogIds }, status: "pending" },
          select: { id: true },
        });
        cancelledChaseIds = tasks.map((t) => t.id);
        if (cancelledChaseIds.length > 0) {
          await ptx.chaseTask.updateMany({
            where: { id: { in: cancelledChaseIds } },
            data: { status: "cancelled" },
          });
        }
      }
      // 3. Cancel active ClientChaseState rows on this transaction. The
      //    file is dead — no further client chases should fire, whether
      //    or not a relist follows. Without this, stale "active" rows
      //    survive and the agent's Reminders tab keeps surfacing them as
      //    "Upcoming (predicted)" with dates in the past (the prediction
      //    code in lib/services/automated-emails-preview.ts walks active
      //    CCS rows). Covers vendor + purchaser sides — vendor CCS gets
      //    cancelled too since the file as a whole is dead.
      //    Idempotent via status="active" precondition.
      const ccsResult = await ptx.clientChaseState.updateMany({
        where: { transactionId, status: "active" },
        // 2026-07-13 (Chunk 6f/7): stamp the SAME plain-English string
        // the ReminderLog statusReason on line 617 uses so the two models
        // read consistently in the chase-history panel.
        data: { status: "cancelled", statusReason: "sale fell through" },
      });

      // 4. Close any open TransactionHoldPeriods. Belt-and-braces beyond
      //    the existing leavingHold path — that path only fires when the
      //    PREVIOUS status was on_hold. A file that was active with a stale
      //    open hold row (defensive — shouldn't happen via the normal flow)
      //    still gets closed here. Idempotent via where endedAt IS NULL.
      const holdResult = await ptx.transactionHoldPeriod.updateMany({
        where: { transactionId, endedAt: null },
        data: { endedAt: new Date(), endedById: session.user.id },
      });
      return {
        buyerRoundId: tx.activeBuyerRoundId,
        cancelledLogIds,
        cancelledChaseIds,
        cancelledClientChaseStateCount: ccsResult.count,
        holdsClosed: holdResult.count,
      };
    }
    return null;
  });

  // Command Centre event log. Fires once per status mutation. Note: sale_completed
  // is emitted from the milestone path (VM20/PM27 confirmation) per DECISION 4, NOT
  // here when status → "completed". The status path is canonical for transaction_archived
  // (status → "withdrawn") since there is no equivalent milestone for archiving.
  await recordEvent({
    type: "transaction_status_changed",
    agencyId: session.user.agencyId || undefined,
    userId: session.user.id,
    entityType: "PropertyTransaction",
    entityId: transactionId,
    metadata: { from: tx.status, to: status },
  });
  if (status === "withdrawn") {
    // Extend the existing transaction_archived event metadata with the
    // cancellation summary captured inside the $transaction above
    // (Phase-2 PR 1). Doing this here rather than emitting a separate
    // reminder_cancelled_at_fall_through event avoids a Prisma enum
    // migration; the existing event already fires per withdraw so the
    // audit row count stays at 1-per-withdraw.
    await recordEvent({
      type: "transaction_archived",
      agencyId: session.user.agencyId || undefined,
      userId: session.user.id,
      entityType: "PropertyTransaction",
      entityId: transactionId,
      metadata: {
        ...(fallThroughReason ? { reason: fallThroughReason } : {}),
        ...(cancellationSummary
          ? {
              cancellation: {
                hookPoint: "withdraw" as const,
                reason: "sale fell through",
                buyerRoundId: cancellationSummary.buyerRoundId,
                cancelledLogIds: cancellationSummary.cancelledLogIds,
                cancelledChaseIds: cancellationSummary.cancelledChaseIds,
                cancelledClientChaseStateCount: cancellationSummary.cancelledClientChaseStateCount,
                holdsClosed: cancellationSummary.holdsClosed,
              },
            }
          : {}),
      },
    });
  }

  const reasonNote = status === "withdrawn" && fallThroughReason
    ? ` Reason: ${fallThroughReason}.`
    : "";

  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${session.user.name} changed status from ${STATUS_LABELS[tx.status]} to ${STATUS_LABELS[status]}.${reasonNote}`,
      createdById: session.user.id,
    },
  });

  if (status === "completed") {
    sendCompletionSurveys(transactionId).catch(console.error);
  }

  if (status === "withdrawn" && tx.chainLinkId) {
    // Closed-loop chain arc (2026-06-05). The cascade direction(s) AND the
    // orphan-segment detachment side are both derived from the structured
    // WithdrawalReason chosen in the modal. Defaults fall back to OTHER
    // (cascade both, no split) for legacy callers / safety — the StatusControl
    // form requires a reason before Confirm is enabled.
    const reasonForCascade = withdrawalReason ?? "OTHER";
    const rule = CHAIN_CASCADE_RULES[reasonForCascade];
    void (async () => {
      try {
        if (rule.cascadeDirections.length > 0) {
          await cascadeChainWithdrawal(tx.chainLinkId!, rule.cascadeDirections);
        } else {
          // CHAIN_COLLAPSE_ABOVE — just mark our link WITHDRAWN locally;
          // upstream cascade is already in motion and shouldn't be doubled.
          await prisma.chainLink.update({
            where: { id: tx.chainLinkId! },
            data: { withdrawalStatus: "WITHDRAWN" },
          });
        }
        if (rule.orphanDirection) {
          const splitResult = await splitChainAtBoundary({
            withdrawingLinkId: tx.chainLinkId!,
            orphanDirection: rule.orphanDirection,
            agencyId: tx.agencyId,
            withdrawingTransactionId: transactionId,
          });
          // Fold the split metadata back into the round's chainSnapshot so
          // the drawer's "Chain at withdrawal" section can render the
          // detached-segment banner without a second query.
          if (splitResult.kind === "split" && tx.activeBuyerRoundId) {
            const round = await prisma.buyerRound.findUnique({
              where: { id: tx.activeBuyerRoundId },
              select: { chainSnapshot: true },
            });
            const current = (round?.chainSnapshot as Record<string, unknown> | null) ?? {};
            await prisma.buyerRound.update({
              where: { id: tx.activeBuyerRoundId },
              data: {
                chainSnapshot: {
                  ...current,
                  detachedSegment: {
                    chainId: splitResult.orphanChainId,
                    splitAt: new Date().toISOString(),
                    notifiedRecipientLinkId: splitResult.notifiedRecipientLinkId,
                  },
                } as Prisma.InputJsonValue,
              },
            });
          }
        }
      } catch (err) {
        console.error("[changeStatusAction] chain cascade/split failed", err);
      }
    })();
  }

  revalidateTx(transactionId);
}

export async function savePriceAction(transactionId: string, purchasePrice: number) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, purchasePrice: true, activeBuyerRoundId: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (tx.purchasePrice !== purchasePrice) {
    // Phase 1 commit 4e — PriceHistory rows are buyer-side by Phase 0
    // attribution rule (the price is always the buyer's offer). Stamp
    // the active round so post-relist a price change on round 2 is
    // attributed correctly.
    await prisma.priceHistory.create({
      data: {
        transactionId,
        oldPrice: tx.purchasePrice,
        newPrice: purchasePrice,
        changedById: session.user.id,
        buyerRoundId: tx.activeBuyerRoundId,
      },
    });
    const oldFmt = tx.purchasePrice ? `£${(tx.purchasePrice / 100).toLocaleString("en-GB")}` : "not set";
    const newFmt = `£${(purchasePrice / 100).toLocaleString("en-GB")}`;
    await prisma.outboundMessage.create({
      data: {
        transactionId, type: "internal_note", contactIds: [],
        content: `${session.user.name} updated purchase price from ${oldFmt} to ${newFmt}.`,
        createdById: session.user.id,
      },
    });
  }

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data: { purchasePrice } });
  revalidateTx(transactionId);
}

// Calendar-day equality on the stored expected-exchange dates, compared in UTC
// (both are date-only values persisted at UTC midnight). Used to decide whether
// a date genuinely moved before telling clients.
function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function saveOverrideDateAction(transactionId: string, overridePredictedDate: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, overridePredictedDate: true, expectedExchangeDate: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const newDate = overridePredictedDate ? new Date(overridePredictedDate) : null;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { overridePredictedDate: newDate },
  });

  // Client-visible portal entry — only when an existing expected date moves to a
  // different date. First-time set (no prior stored date) and clearing stay
  // silent, per the portal feature-ledger decision (2026-08-30).
  const priorExpected = tx.overridePredictedDate ?? tx.expectedExchangeDate;
  if (newDate && priorExpected && !isSameCalendarDay(priorExpected, newDate)) {
    await postExchangeDateUpdateToClients(transactionId, newDate, session.user.id);
  }

  const dateStr = newDate
    ? newDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  await logActivity(
    transactionId,
    dateStr
      ? `${session.user.name} set expected exchange date to ${dateStr}`
      : `${session.user.name} cleared expected exchange date`,
    session.user.id
  );

  revalidateTx(transactionId);
}

// Scenario D: revise the exchange date on a file that's gone quiet past its
// predicted date. Writes a manual override (which wins on every display surface
// and drops the file out of the hub's overdue list) and records that both
// parties were spoken to. The hard block — bothPartiesInformed must be true —
// is enforced here as well as in the modal, so a date never slides in silence.
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).
export async function reviseOverdueExchangeDateAction(input: {
  transactionId: string;
  newDate: string; // ISO yyyy-mm-dd from the date input
  bothPartiesInformed: boolean;
}) {
  const session = await requireSession();

  if (!input.bothPartiesInformed) {
    throw new Error("Confirm both parties have been told before revising the date");
  }
  const parsed = new Date(input.newDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Enter a valid date");
  }

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, overridePredictedDate: true, expectedExchangeDate: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: { overridePredictedDate: parsed },
  });

  // Client-visible portal entry — only when an existing expected date moves to a
  // different date (skip a first-ever set), per the feature-ledger decision.
  const priorExpected = tx.overridePredictedDate ?? tx.expectedExchangeDate;
  if (priorExpected && !isSameCalendarDay(priorExpected, parsed)) {
    await postExchangeDateUpdateToClients(input.transactionId, parsed, session.user.id);
  }

  const dateStr = parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  await logActivity(
    input.transactionId,
    `${session.user.name} revised the expected exchange date to ${dateStr} after speaking to both parties`,
    session.user.id,
  );

  revalidateTx(input.transactionId);
  revalidatePath("/agent/hub", "page");
}

export async function saveAgentFeeAction(input: {
  transactionId: string;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean;
}) {
  const session = await requireSession();
  if (session.user.role === "sales_progressor") throw new Error("Forbidden: sales_progressor cannot edit commercial fee data");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: {
      agentFeeAmount: input.agentFeeAmount,
      agentFeePercent: input.agentFeePercent,
      agentFeeIsVatInclusive: input.agentFeeIsVatInclusive,
    },
  });

  await logActivity(
    input.transactionId,
    `${session.user.name} updated agent fee`,
    session.user.id
  );

  revalidateTx(input.transactionId);
}

// Director-only: change which agency user OWNS a file (agentUserId on
// PropertyTransaction). Negotiators can't reassign. Internal staff can't
// use this — assigning an internal progressor goes through
// assignUserAction below (which writes assignedUserId, a different field).
//
// Validates that:
//   - caller is a director
//   - file is in caller's agency
//   - target user is a director or negotiator in the same agency
//
// Writes an activity-feed note so the change is visible on the file timeline.
export async function reassignAgentAction(transactionId: string, newAgentUserId: string) {
  const session = await requireSession();
  if (session.user.role !== "director") {
    throw new Error("Forbidden: only a director can reassign a file");
  }
  if (!session.user.agencyId) {
    throw new Error("Forbidden: caller has no agency");
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true, agentUserId: true, agencyId: true },
  });
  if (!tx) throw new Error("File not found in your agency");

  const target = await prisma.user.findUnique({
    where: { id: newAgentUserId },
    select: { id: true, name: true, agencyId: true, role: true },
  });
  if (!target || target.agencyId !== session.user.agencyId) {
    throw new Error("Cannot assign to a user outside your agency");
  }
  if (target.role !== "director" && target.role !== "negotiator") {
    throw new Error("Cannot assign to a non-agent user");
  }

  if (tx.agentUserId === newAgentUserId) {
    return; // no-op
  }

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { agentUserId: newAgentUserId },
  });

  await logActivity(
    transactionId,
    `${session.user.name ?? "Director"} reassigned file to ${target.name ?? target.id}`,
    session.user.id,
  );

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/agent/transactions`);
}

export async function assignUserAction(transactionId: string, assignedUserId: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  if (scope.kind !== "all") throw new Error("Forbidden: only admin can assign a progressor");

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId },
    select: { id: true, assignedUserId: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const previousAssigneeId = tx.assignedUserId;
  const isNewAssignment = !!assignedUserId && assignedUserId !== previousAssigneeId;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { assignedUserId: assignedUserId || null, assignedAt: assignedUserId ? new Date() : null },
  });

  const assignee = assignedUserId
    ? await prisma.user.findFirst({ where: { id: assignedUserId }, select: { name: true } })
    : null;
  await logActivity(
    transactionId,
    assignee
      ? `${session.user.name} assigned file to ${assignee.name}`
      : `${session.user.name} unassigned file`,
    session.user.id
  );

  // Push the NEW assignee (not the displaced one). Skipped for unassignment.
  if (isNewAssignment && assignedUserId) {
    pushFileAssigned({
      transactionId,
      assigneeUserId: assignedUserId,
      assignerName: session.user.name ?? "Admin",
    }).catch(() => {});
  }

  revalidateTx(transactionId);
}

// Admin (or hybrid-admin email) correction path: an agent set up the file with the
// wrong service type and we need to flip it. serviceType + progressedBy are read
// live by reminders, hub bucketing, billing-at-exchange, and the agency mode
// profile recompute, so downstream systems recalibrate without any extra wiring.
//
// Switching TO outsourced leaves assignedUserId as-is — if null, the file lands
// in the "Needs SP assigning" bucket on the hub (consistent with brand-new
// outsourced creates). Switching TO self_managed clears assignedUserId / assignedAt
// since no SP is managing it anymore.
//
// No email goes out. The OutsourcedAssignmentNotification model exists in the
// schema but no send code is written yet; future work can wire it through both
// the create paths and this switch.
export async function switchServiceTypeAction(
  transactionId: string,
  target: "self_managed" | "outsourced",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) {
    return { ok: false, error: "Forbidden" };
  }

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, serviceType: true, status: true },
  });
  if (!tx) {
    return { ok: false, error: "Transaction not found" };
  }
  if (tx.status !== "active") {
    return { ok: false, error: "Only active files can be switched." };
  }
  if (tx.serviceType === target) {
    return { ok: true };
  }

  const SERVICE_LABEL = { self_managed: "Self-managed", outsourced: "Outsourced" } as const;
  const prevLabel = SERVICE_LABEL[tx.serviceType as "self_managed" | "outsourced"];
  const nextLabel = SERVICE_LABEL[target];
  const nextProgressedBy = target === "outsourced" ? "progressor" : "agent";

  await prisma.$transaction(async (db) => {
    await db.propertyTransaction.update({
      where: { id: transactionId },
      data: {
        serviceType: target,
        progressedBy: nextProgressedBy,
        // Outsourced → self_managed: drop any SP assignment, since no SP is
        // managing the file anymore. Outsourced files keep their existing
        // assignment (or null, which routes them to "Needs SP assigning").
        // Switching TO outsourced (re)starts the SP waiting clock from now.
        ...(target === "self_managed"
          ? { assignedUserId: null, assignedAt: null }
          : { outsourcedAt: new Date() }),
      },
    });

    // Audit trail: internal-note row on the activity timeline. isAutomated:false
    // because this was a deliberate admin action, not a system event.
    await db.outboundMessage.create({
      data: {
        transactionId,
        type: "internal_note",
        content: `${session.user.name ?? "Admin"} switched this file from ${prevLabel} to ${nextLabel}.`,
        createdById: session.user.id,
        createdByRole: session.user.role,
        isAutomated: false,
      },
    });
  });

  revalidateTx(transactionId);
  return { ok: true };
}

export async function saveSolicitorsAction(transactionId: string, patch: {
  vendorSolicitorFirmId?: string | null;
  vendorSolicitorContactId?: string | null;
  purchaserSolicitorFirmId?: string | null;
  purchaserSolicitorContactId?: string | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const { referredFirmId, referralFee, ...solicitorPatch } = patch;
  const data: Record<string, unknown> = { ...solicitorPatch };
  if (referredFirmId !== undefined) {
    data.referredFirmId = referredFirmId;
    data.referralFee = referralFee ?? null;
  }

  // Single query for auth + update — updateMany with scope-where collapses
  // the prior findFirst + update into one round-trip. count===0 means the
  // row doesn't exist OR is out of scope; we treat both the same.
  const result = await prisma.propertyTransaction.updateMany({
    where: scopeOwnershipWhere(scope, transactionId),
    data,
  });
  if (result.count === 0) throw new Error("Transaction not found");

  // Fire-and-forget audit log — the action returns faster, and the audit
  // row lands on the next page render anyway (next revalidation pass).
  void logActivity(transactionId, `${session.user.name} updated solicitor details`, session.user.id).catch((err) =>
    console.error("[saveSolicitorsAction] logActivity failed:", err),
  );

  revalidateTx(transactionId);
}

export async function savePurchaseTypeAction(transactionId: string, purchaseType: PurchaseType) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data: { purchaseType } });

  const TYPE_LABELS: Record<string, string> = { cash: "Cash", mortgage: "Mortgage", unknown: "Unknown" };
  await logActivity(
    transactionId,
    `${session.user.name} changed purchase type to ${TYPE_LABELS[purchaseType] ?? purchaseType}`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function saveReferralAction(
  transactionId: string,
  data: { referredFirmId: string | null; referralFee: number | null; referralFeeReceived: boolean }
) {
  const session = await requireSession();
  if (session.user.role === "sales_progressor") throw new Error("Forbidden: sales_progressor cannot edit commercial fee data");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: {
      referredFirmId:      data.referredFirmId,
      referralFee:         data.referralFee,
      referralFeeReceived: data.referralFeeReceived,
    },
  });

  await logActivity(transactionId, `${session.user.name} updated referral details`, session.user.id);

  revalidateTx(transactionId);
}

export async function saveBrokerReferralAction(
  transactionId: string,
  data: {
    brokerFirmId: string | null;
    brokerContactId: string | null;
    brokerReferralFee: number | null;
    brokerReferralFeeReceived: boolean;
    // Optional — set when attaching a broker on a live file (drives the
    // confirmed-broker row on the buyer's portal team). Omitted by the fee
    // editor, which leaves the existing value untouched.
    purchaserBrokerReferral?: boolean;
  }
) {
  const session = await requireSession();
  if (session.user.role === "sales_progressor") throw new Error("Forbidden: sales_progressor cannot edit commercial fee data");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: {
      brokerFirmId:              data.brokerFirmId,
      brokerContactId:           data.brokerContactId,
      brokerReferralFee:         data.brokerReferralFee,
      brokerReferralFeeReceived: data.brokerReferralFeeReceived,
      ...(data.purchaserBrokerReferral !== undefined
        ? { purchaserBrokerReferral: data.purchaserBrokerReferral }
        : {}),
    },
  });

  await logActivity(transactionId, `${session.user.name} updated broker referral details`, session.user.id);

  revalidateTx(transactionId);
}

export async function getAddressConsequencesAction(transactionId: string): Promise<{ commCount: number; milestoneCount: number }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  // Round-scoped milestone count for the per-tx address-change
  // consequences modal (shows agent "this many comms, this many
  // milestones complete on this file"). active round + vendor.
  const addrConseqTx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  const addrConseqScope = forRound(addrConseqTx?.activeBuyerRoundId ?? null, transactionId);
  const [commCount, milestoneCount] = await Promise.all([
    prisma.outboundMessage.count({ where: { transactionId } }),
    prisma.milestoneCompletion.count({
      where: { transactionId, state: "complete", ...milestoneScopeWhere(addrConseqScope) },
    }),
  ]);
  return { commCount, milestoneCount };
}

export async function saveAddressAction(transactionId: string, newAddress: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const trimmed = newAddress.trim();
  if (!trimmed) throw new Error("Address cannot be empty");
  if (trimmed === tx.propertyAddress) return;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { propertyAddress: trimmed },
  });

  await logActivity(
    transactionId,
    `${session.user.name} updated property address to "${trimmed}"`,
    session.user.id
  );

  revalidateTx(transactionId);
}

export async function saveIsShareOfFreeholdAction(transactionId: string, isShareOfFreehold: boolean): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, isShareOfFreehold: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.isShareOfFreehold === isShareOfFreehold) return;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { isShareOfFreehold },
  });

  await logActivity(
    transactionId,
    `${session.user.name} set property type to ${isShareOfFreehold ? "share of freehold" : "standard leasehold"}`,
    session.user.id
  );

  revalidateTx(transactionId);
}

// ─── Draft actions ────────────────────────────────────────────────────────────

const DRAFT_STATUS = "draft" as TransactionStatus;

export async function saveDraftAction(data: {
  draftId?: string;
  propertyAddress: string;
  tenure?: Tenure | null;
  purchaseType?: PurchaseType | null;
  purchasePrice?: number | null;
  notes?: string | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  agentFeeIsVatInclusive?: boolean | null;
  vendors?: Array<{ name: string; phone?: string | null; email?: string | null }>;
  purchasers?: Array<{ name: string; phone?: string | null; email?: string | null }>;
  vendorSolicitorFirmId?: string | null;
  vendorSolicitorContactId?: string | null;
  purchaserSolicitorFirmId?: string | null;
  purchaserSolicitorContactId?: string | null;
  referredFirmId?: string | null;
  referralFee?: number | null;
  brokerFirmId?: string | null;
  brokerContactId?: string | null;
  brokerReferralFee?: number | null;
  mosStoragePath?: string | null;
  mosFileSize?: number | null;
  mosMimeType?: string | null;
  mosFilename?: string | null;
  progressedBy?: "progressor" | "agent";
  chainStubs?: Array<{
    direction: "above" | "below";
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentName: string;
    stubAgentEmail: string;
    stubAgentPhone: string;
    stubNotes: string;
  }>;
}) {
  const session = await requireSession();

  const vendorContacts = (data.vendors ?? [])
    .filter((v) => v.name?.trim())
    .map((v) => ({ name: v.name.trim(), phone: v.phone?.trim() || null, email: v.email?.trim() || null, roleType: "vendor" as ContactRole }));
  const purchaserContacts = (data.purchasers ?? [])
    .filter((p) => p.name?.trim())
    .map((p) => ({ name: p.name.trim(), phone: p.phone?.trim() || null, email: p.email?.trim() || null, roleType: "purchaser" as ContactRole }));
  const allContacts = [...vendorContacts, ...purchaserContacts];

  const scalarData = {
    propertyAddress: normaliseAddressString(data.propertyAddress),
    tenure: data.tenure ?? null,
    purchaseType: data.purchaseType ?? null,
    purchasePrice: data.purchasePrice ?? null,
    notes: data.notes ?? null,
    agentFeeAmount: data.agentFeeAmount ?? null,
    agentFeePercent: data.agentFeePercent ?? null,
    agentFeeIsVatInclusive: data.agentFeeIsVatInclusive ?? null,
    vendorSolicitorFirmId: data.vendorSolicitorFirmId ?? null,
    vendorSolicitorContactId: data.vendorSolicitorContactId ?? null,
    purchaserSolicitorFirmId: data.purchaserSolicitorFirmId ?? null,
    purchaserSolicitorContactId: data.purchaserSolicitorContactId ?? null,
    referredFirmId: data.referredFirmId ?? null,
    referralFee: data.referralFee ?? null,
    brokerFirmId: data.brokerFirmId ?? null,
    brokerContactId: data.brokerContactId ?? null,
    brokerReferralFee: data.brokerReferralFee ?? null,
  };

  async function saveMosDocument(transactionId: string) {
    await prisma.transactionDocument.deleteMany({ where: { transactionId, source: "mos" } });
    if (data.mosStoragePath && data.mosFileSize && data.mosMimeType) {
      await prisma.transactionDocument.create({
        data: {
          transactionId,
          filename: data.mosFilename ?? "Memorandum of Sale",
          storagePath: data.mosStoragePath,
          fileSize: data.mosFileSize,
          mimeType: data.mosMimeType,
          source: "mos",
        },
      }).catch(console.error);
    }
  }

  async function saveChain(transactionId: string, existingChainLinkId: string | null) {
    if (existingChainLinkId) {
      const oldLink = await prisma.chainLink.findUnique({ where: { id: existingChainLinkId }, select: { chainId: true } });
      if (oldLink) {
        await prisma.propertyTransaction.update({ where: { id: transactionId }, data: { chainLinkId: null } });
        await prisma.chainLink.deleteMany({ where: { chainId: oldLink.chainId } });
        await prisma.propertyChain.delete({ where: { id: oldLink.chainId } }).catch(() => {});
      }
    }
    if (data.chainStubs && data.chainStubs.length > 0) {
      await createChainV2({
        transactionId,
        agencyId: session.user.agencyId ?? "",
        userId: session.user.id,
        stubs: data.chainStubs,
      }).catch(console.error);
    }
  }

  if (data.draftId) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { ...scopeOwnershipWhere(getAccessScope(session), data.draftId), status: DRAFT_STATUS },
      select: { id: true, chainLinkId: true, activeBuyerRoundId: true },
    });
    if (!existing) throw new Error("Draft not found");

    await prisma.propertyTransaction.update({ where: { id: data.draftId }, data: scalarData });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: data.draftId } });
    if (allContacts.length > 0) {
      await prisma.contact.createMany({
        data: allContacts.map((c) => ({
          ...c,
          propertyTransactionId: data.draftId!,
          // Stamp purchaser contacts with the existing draft's active
          // round. Phase 0 backfill seeded a Round 1 on every pre-4b
          // draft; this branch never sees activeBuyerRoundId=null in
          // practice, but the ?? null fallback keeps the type clean.
          buyerRoundId: c.roleType === "purchaser" ? (existing.activeBuyerRoundId ?? null) : null,
        })),
      });
    }
    await saveMosDocument(data.draftId);
    await saveChain(data.draftId, existing.chainLinkId);

    revalidatePath("/agent/transactions/new");
    return { id: data.draftId };
  }

  // Internal staff (agencyId = null) can't CREATE drafts: every
  // PropertyTransaction row belongs to a customer agency (agencyId is a
  // required column), and createTransactionAction blocks the same case
  // with "Cannot create transaction without an agency". Without this
  // guard the create below dies in Prisma with a constraint error the
  // UI can only render as a generic failure (reported 2026-08-11 by
  // Ellis saving a draft while logged in as internal staff). Updating
  // an EXISTING agency draft (the branch above) stays allowed for
  // internal admins — the agency is already set on the row.
  if (!session.user.agencyId) {
    return { id: null, error: "no_agency" } as const;
  }

  // Create new draft. Phase 1: stand up Round 1 inside the same
  // $transaction as the PropertyTransaction.create — every tx in the
  // database has a Round 1 from the first millisecond, even drafts.
  const tx = await prisma.$transaction(async (ptx) => {
    const created = await ptx.propertyTransaction.create({
      data: {
        ...scalarData,
        status: DRAFT_STATUS,
        agencyId: session.user.agencyId,
        agentUserId: session.user.id,
        progressedBy: data.progressedBy ?? "progressor",
        serviceType: (data.progressedBy ?? "progressor") === "progressor" ? "outsourced" : "self_managed",
      },
    });
    const round = await ptx.buyerRound.create({
      data: {
        transactionId: created.id,
        roundNumber: 1,
        status: "active",
        purchasePrice: created.purchasePrice,
        purchaserSolicitorFirmId: created.purchaserSolicitorFirmId,
        purchaserSolicitorContactId: created.purchaserSolicitorContactId,
        brokerFirmId: created.brokerFirmId,
        brokerContactId: created.brokerContactId,
      },
    });
    return ptx.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: round.id },
    });
  });

  if (allContacts.length > 0) {
    await prisma.contact.createMany({
      data: allContacts.map((c) => ({
        ...c,
        propertyTransactionId: tx.id,
        buyerRoundId: c.roleType === "purchaser" ? tx.activeBuyerRoundId : null,
      })),
    });
  }
  await saveMosDocument(tx.id);
  await saveChain(tx.id, null);

  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/transactions/new");
  return { id: tx.id };
}

export async function promoteDraftAction(
  draftId: string,
  data: {
    propertyAddress: string;
    tenure: Tenure;
    purchaseType: PurchaseType;
    purchasePrice: number | null;
    contacts: { name: string; phone: string | null; email?: string | null; roleType: ContactRole }[];
    progressedBy?: "progressor" | "agent";
  }
) {
  const session = await requireSession();

  const draft = await prisma.propertyTransaction.findFirst({
    where: { id: draftId, agencyId: session.user.agencyId, status: DRAFT_STATUS },
    // notes feeds the sale-setup note write-through below; serviceType resolves
    // the free label when the promotion doesn't itself change progressedBy.
    select: { id: true, activeBuyerRoundId: true, notes: true, agencyId: true, serviceType: true },
  });
  if (!draft) throw new Error("Draft not found");

  // Pricing migration (2026-08): the sale goes live here. Resolve its final
  // service type (the promotion may or may not change progressedBy) and label
  // a self-run sale as free by type; an outsourced sale stays unlabelled until
  // its exchange-time first-free decision.
  const finalServiceType = data.progressedBy
    ? (data.progressedBy === "agent" ? "self_managed" : "outsourced")
    : draft.serviceType;
  const promotedFreeReason = finalServiceType === "self_managed" ? "permanent_free_self" : null;

  // Defensive Round-1 backfill for drafts that pre-date the
  // saveDraftAction wiring (Phase 1 follow-up commit). Idempotent —
  // saveDraftAction wires this at draft-create from here on, so the
  // findFirst returns the existing round and we skip the create.
  let activeBuyerRoundId = draft.activeBuyerRoundId;
  if (!activeBuyerRoundId) {
    activeBuyerRoundId = await prisma.$transaction(async (ptx) => {
      const round = await ptx.buyerRound.create({
        data: {
          transactionId: draft.id,
          roundNumber: 1,
          status: "active",
          purchasePrice: data.purchasePrice,
          purchaserSolicitorFirmId: null,
          purchaserSolicitorContactId: null,
          brokerFirmId: null,
          brokerContactId: null,
        },
      });
      await ptx.propertyTransaction.update({
        where: { id: draft.id },
        data: { activeBuyerRoundId: round.id },
      });
      return round.id;
    });
  }

  // Delete existing contacts on the draft and recreate
  await prisma.contact.deleteMany({ where: { propertyTransactionId: draftId } });
  if (data.contacts.length > 0) {
    await prisma.contact.createMany({
      data: data.contacts.map((c) => ({
        propertyTransactionId: draftId,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        roleType: c.roleType,
        portalToken: randomUUID(),
        buyerRoundId: c.roleType === "purchaser" ? activeBuyerRoundId : null,
      })),
    });
  }

  await prisma.propertyTransaction.update({
    where: { id: draftId },
    data: {
      propertyAddress: normaliseAddressString(data.propertyAddress),
      tenure: data.tenure,
      purchaseType: data.purchaseType,
      purchasePrice: data.purchasePrice,
      status: "active",
      freeReason: promotedFreeReason,
      pricingVersion: CURRENT_PRICING_VERSION,
      ...(data.progressedBy ? {
        progressedBy: data.progressedBy,
        serviceType: data.progressedBy === "progressor" ? "outsourced" : "self_managed",
      } : {}),
    },
  });

  // Sale-setup notes → the file's Notes feed, same as the direct-create
  // path (2026-08-19). Drafts carry the notes on the row; the note only
  // becomes a feed entry once the file goes live here.
  if (draft.notes?.trim()) {
    await prisma.outboundMessage.create({
      data: {
        transactionId: draftId,
        agencyId: draft.agencyId,
        type: "internal_note",
        // "Setup note" is the marker the Notes card pins on.
        subject: "Setup note",
        contactIds: [],
        content: draft.notes.trim(),
        createdById: session.user.id,
        createdByRole: session.user.role,
      },
    }).catch((err) => console.error("Sale-setup note write failed:", err));
  }

  // A draft that was saved via saveDraftAction has no milestone
  // completions yet (initializeMilestoneCompletions is gated on
  // tenure + purchaseType which a draft may lack until promote).
  // Run it now; idempotent — if rows already exist (e.g. a draft
  // saved through createTransactionAction got initialized at create
  // time) the helper no-ops on existing rows.
  await initializeMilestoneCompletions(
    draftId,
    data.tenure,
    data.purchaseType,
    session.user.id,
    activeBuyerRoundId,
  );

  evaluateTransactionReminders(draftId).catch(() => {});
  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/all-files");
  return { id: draftId };
}

export async function discardDraftAction(draftId: string) {
  const session = await requireSession();
  await prisma.propertyTransaction.deleteMany({
    where: { id: draftId, agencyId: session.user.agencyId, status: DRAFT_STATUS },
  });
  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/transactions/new");
}

// ─── Edit Sale Details reconciliation ────────────────────────────────────────

// Auto-NR rule lives in lib/milestone-auto-nr.ts. PURCHASE_TYPE_NR_CODES and
// FREEHOLD_NR_CODES are re-exported from there so the comms-text branching
// below can tell "this milestone was reversed because purchaseType changed"
// from "this milestone was reversed because tenure changed".
const EXCHANGE_GATE_CODES_SET = new Set(["VM18", "PM25"]);

function computeNewMilestoneState(code: string, stateByCode: Map<string, string>): "available" | "locked" {
  if (EXCHANGE_GATE_CODES_SET.has(code)) return "locked";
  const prereqs = DIRECT_PREREQUISITES[code] ?? [];
  if (prereqs.length === 0) return "available";
  const allSatisfied = prereqs.every((p) => {
    const s = stateByCode.get(p);
    return s === "complete" || s === "not_required";
  });
  return allSatisfied ? "available" : "locked";
}

function calcSidePercent(milestones: { weight: number; isComplete: boolean; isNotRequired: boolean }[]): number {
  const applicable = milestones.filter((m) => !m.isNotRequired);
  const denom = applicable.reduce((s, m) => s + m.weight, 0);
  if (denom === 0) return 100;
  const num = applicable.filter((m) => m.isComplete).reduce((s, m) => s + m.weight, 0);
  return (num / denom) * 100;
}

export type SaleDetailsDeltaItem = { id: string; name: string; code: string; side: string; weight: number; wasComplete: boolean };

export type SaleDetailsDelta = {
  noChange: boolean;
  becomingNr: SaleDetailsDeltaItem[];
  becomingRequired: SaleDetailsDeltaItem[];
  currentPercent: number;
  projectedPercent: number;
  currentRemaining: number;
  projectedRemaining: number;
};

export async function getSaleDetailsDelta(input: {
  transactionId: string;
  newPurchaseType: PurchaseType;
  newTenure: Tenure;
}): Promise<SaleDetailsDelta> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, purchaseType: true, tenure: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.newPurchaseType === tx.purchaseType && input.newTenure === tx.tenure) {
    return { noChange: true, becomingNr: [], becomingRequired: [], currentPercent: 0, projectedPercent: 0, currentRemaining: 0, projectedRemaining: 0 };
  }

  const oldNrCodes = computeAutoNrCodes(tx.purchaseType, tx.tenure);
  const newNrCodes = computeAutoNrCodes(input.newPurchaseType, input.newTenure);

  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, name: true, side: true, weight: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  const defByCode = new Map(allDefs.map((d) => [d.code, d]));
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));

  // Round-scoped: confirmSaleDetailsAction reads the current per-tx
  // milestone state to project NR-cascade changes; the projection must
  // reflect the active round's state, not include archived rounds'
  // legacy PMs.
  const saleDetailsTx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const saleDetailsScope = forRound(saleDetailsTx?.activeBuyerRoundId ?? null, input.transactionId);
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId, ...milestoneScopeWhere(saleDetailsScope) },
    select: { milestoneDefinitionId: true, state: true },
  });

  const stateByCode = new Map(completions.map((c) => [codeById.get(c.milestoneDefinitionId) ?? "", c.state as string]));

  const becomingNr: SaleDetailsDeltaItem[] = [];
  const becomingRequired: SaleDetailsDeltaItem[] = [];

  for (const code of newNrCodes) {
    if (oldNrCodes.has(code)) continue;
    const def = defByCode.get(code);
    if (!def) continue;
    const state = stateByCode.get(code);
    if (state === "not_required") continue; // already NR — no-op
    becomingNr.push({ id: def.id, name: def.name, code, side: def.side, weight: Number(def.weight), wasComplete: state === "complete" });
  }

  for (const code of oldNrCodes) {
    if (newNrCodes.has(code)) continue;
    const def = defByCode.get(code);
    if (!def) continue;
    if (stateByCode.get(code) === "not_required") {
      becomingRequired.push({ id: def.id, name: def.name, code, side: def.side, weight: Number(def.weight), wasComplete: false });
    }
  }

  // Simulate projected state for percent calculation
  const projectedStates = new Map(stateByCode);
  for (const item of becomingNr) projectedStates.set(item.code, "not_required");
  for (const item of becomingRequired) projectedStates.set(item.code, computeNewMilestoneState(item.code, projectedStates));

  const vendor = allDefs.filter((d) => d.side === "vendor");
  const purchaser = allDefs.filter((d) => d.side === "purchaser");

  const toLite = (defs: typeof allDefs, states: Map<string, string>) =>
    defs.map((d) => {
      const s = states.get(d.code) ?? "locked";
      return { weight: Number(d.weight), isComplete: s === "complete", isNotRequired: s === "not_required" };
    });

  const currentLite = [...toLite(vendor, stateByCode), ...toLite(purchaser, stateByCode)];
  const projectedLite = [...toLite(vendor, projectedStates), ...toLite(purchaser, projectedStates)];

  const currentPercent = Math.round((calcSidePercent(toLite(vendor, stateByCode)) + calcSidePercent(toLite(purchaser, stateByCode))) / 2);
  const projectedPercent = Math.round((calcSidePercent(toLite(vendor, projectedStates)) + calcSidePercent(toLite(purchaser, projectedStates))) / 2);
  const currentRemaining = currentLite.filter((m) => !m.isNotRequired && !m.isComplete).length;
  const projectedRemaining = projectedLite.filter((m) => !m.isNotRequired && !m.isComplete).length;

  return { noChange: false, becomingNr, becomingRequired, currentPercent, projectedPercent, currentRemaining, projectedRemaining };
}

export async function confirmSaleDetailsAction(input: {
  transactionId: string;
  newPurchaseType: PurchaseType;
  newTenure: Tenure;
}): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, purchaseType: true, tenure: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.newPurchaseType === tx.purchaseType && input.newTenure === tx.tenure) return;

  const oldNrCodes = computeAutoNrCodes(tx.purchaseType, tx.tenure);
  const newNrCodes = computeAutoNrCodes(input.newPurchaseType, input.newTenure);

  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, name: true, side: true, blocksExchange: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const defByCode = new Map(allDefs.map((d) => [d.code, d]));
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));

  // Round-scoped: confirmSaleDetailsAction's apply step needs the same
  // round semantics as the projection step above.
  const applyTx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const applyScope = forRound(applyTx?.activeBuyerRoundId ?? null, input.transactionId);
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId, ...milestoneScopeWhere(applyScope) },
    select: { milestoneDefinitionId: true, state: true },
  });
  const stateByCode = new Map(completions.map((c) => [codeById.get(c.milestoneDefinitionId) ?? "", c.state as string]));

  // Codes that are newly becoming NR — includes complete milestones (will be reversed)
  const toNrCodes = [...newNrCodes].filter((c) => !oldNrCodes.has(c) && stateByCode.get(c) !== "not_required");

  // Codes that were auto-NR and must return to required
  const toRequiredCodes = [...oldNrCodes].filter((c) => !newNrCodes.has(c) && stateByCode.get(c) === "not_required");

  // Simulate NR writes first so re-activation prereq check sees correct state
  const projectedStates = new Map(stateByCode);
  for (const code of toNrCodes) projectedStates.set(code, "not_required");

  const reactivatedStates = new Map<string, "available" | "locked">();
  for (const code of toRequiredCodes) {
    const newState = computeNewMilestoneState(code, projectedStates);
    reactivatedStates.set(code, newState);
    projectedStates.set(code, newState);
  }

  // Reminder logs for NR'd milestones
  const nrReminderLogs = toNrCodes.length > 0
    ? await prisma.reminderLog.findMany({
        where: {
          transactionId: input.transactionId,
          status: "active",
          reminderRule: { targetMilestoneCode: { in: toNrCodes } },
        },
        select: { id: true },
      })
    : [];

  // Which sides have blocksExchange milestones in the affected set — need gate sync
  const affectedSides = new Set<MilestoneSide>();
  for (const code of [...toNrCodes, ...toRequiredCodes]) {
    const def = defByCode.get(code);
    if (def?.blocksExchange) affectedSides.add(def.side);
  }


  await prisma.$transaction(async (ptx) => {
    // 1. Update sale details
    await ptx.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { purchaseType: input.newPurchaseType, tenure: input.newTenure },
    });

    // Phase 1 commit 4e — round scope reused across every find-after-write
    // site in this $transaction. activeBuyerRoundId re-read here inside
    // the ptx so the snapshot is consistent with the ptx's view.
    const sdTxRow = await ptx.propertyTransaction.findUnique({
      where: { id: input.transactionId },
      select: { activeBuyerRoundId: true },
    });
    const sdScope = forRound(sdTxRow?.activeBuyerRoundId ?? null, input.transactionId);

    // 2. NR milestones (includes reversal of complete ones)
    const reversedCodes: string[] = [];
    for (const code of toNrCodes) {
      const def = defByCode.get(code);
      if (!def) continue;
      const nrReason = FREEHOLD_NR_CODES.has(code) ? "Freehold property"
        : input.newPurchaseType === "cash_buyer" ? "Cash buyer" : "Cash from proceeds";
      const wasComplete = stateByCode.get(code) === "complete";
      // Compound upsert key removed in commit 1 of Phase 1; locate the row
      // by (tx, def) and update by id. Single row at this point because
      // confirmSaleDetailsAction only runs on existing tx with seeded
      // completions.
      const nrRow = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: def.id,
          ...milestoneScopeWhere(sdScope),
        },
        select: { id: true },
      });
      if (nrRow) {
        await ptx.milestoneCompletion.update({
          where: { id: nrRow.id },
          data: {
            state: "not_required",
            notRequiredReason: nrReason,
            completedAt: null,
            completedById: session.user.id,
            summaryText: wasComplete ? null : undefined,
          },
        });
      }
      if (wasComplete) reversedCodes.push(code);
    }

    // 3a. Comms records for reversed milestones
    const TYPE_LABEL_COMMS: Record<string, string> = { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from proceeds" };
    const TENURE_LABEL_COMMS: Record<string, string> = { leasehold: "Leasehold", freehold: "Freehold" };
    for (const code of reversedCodes) {
      const def = defByCode.get(code);
      if (!def) continue;
      const changeDesc = PURCHASE_TYPE_NR_CODES.has(code)
        ? `purchase type changed from ${TYPE_LABEL_COMMS[tx.purchaseType ?? ""] ?? tx.purchaseType} to ${TYPE_LABEL_COMMS[input.newPurchaseType]}`
        : `tenure changed from ${TENURE_LABEL_COMMS[tx.tenure ?? ""] ?? tx.tenure} to ${TENURE_LABEL_COMMS[input.newTenure]}`;
      await ptx.outboundMessage.create({
        data: {
          transactionId: input.transactionId,
          type: "internal_note",
          contactIds: [],
          content: `Milestone reversed: "${def.name}" no longer applies — ${changeDesc}.`,
          createdById: session.user.id,
        },
      });
    }

    // ATOMICITY_TEST: throw new Error("Atomicity test — roll back");

    // 4. Re-activate milestones
    for (const [code, newState] of reactivatedStates) {
      const def = defByCode.get(code);
      if (!def) continue;
      const reactivateRow = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: def!.id,
          ...milestoneScopeWhere(sdScope),
        },
        select: { id: true },
      });
      if (reactivateRow) {
        await ptx.milestoneCompletion.update({
          where: { id: reactivateRow.id },
          data: { state: newState, notRequiredReason: null, completedAt: null, completedById: null },
        });
      }
    }

    // 5. Deactivate reminder logs for NR'd milestones
    if (nrReminderLogs.length > 0) {
      const logIds = nrReminderLogs.map((l) => l.id);
      await ptx.chaseTask.updateMany({
        where: { reminderLogId: { in: logIds }, status: "pending" },
        data: { status: "inactive" },
      });
      await ptx.reminderLog.updateMany({
        where: { id: { in: logIds } },
        data: { status: "inactive", statusReason: "Marked not required after sale details changed" },
      });
    }

    // 6. Gate sync for each affected side
    for (const side of affectedSides) {
      const gateCode = side === "vendor" ? "VM18" : "PM25";
      const gateDef = defByCode.get(gateCode);
      if (!gateDef) continue;
      const gateDefId = gateDef!.id;

      const gateComp = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: gateDefId,
          ...milestoneScopeWhere(sdScope),
        },
        select: { state: true },
      });
      if (!gateComp) continue;
      const gateState = gateComp!.state;
      if (gateState === "complete" || gateState === "not_required") continue;

      const blockers = allDefs.filter((d) => d.side === side && d.blocksExchange && d.code !== gateCode);
      const blockerComps = await ptx.milestoneCompletion.findMany({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: { in: blockers.map((b) => b.id) },
          ...milestoneScopeWhere(sdScope),
        },
        select: { milestoneDefinitionId: true, state: true },
      });
      const blockerMap = new Map(blockerComps.map((c) => [c.milestoneDefinitionId, c.state]));

      const allClear = blockers.every((b) => {
        const s = blockerMap.get(b.id);
        return s === "complete" || s === "not_required";
      });

      if (allClear && gateState === "locked") {
        const gateRow = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: gateDefId,
            ...milestoneScopeWhere(sdScope),
          },
          select: { id: true },
        });
        if (gateRow) {
          await ptx.milestoneCompletion.update({
            where: { id: gateRow.id },
            data: { state: "available" },
          });
        }
      } else if (!allClear && gateState === "available") {
        const gateRow = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: gateDefId,
            ...milestoneScopeWhere(sdScope),
          },
          select: { id: true },
        });
        if (gateRow) {
          await ptx.milestoneCompletion.update({
            where: { id: gateRow.id },
            data: { state: "locked" },
          });
        }
      }
    }
  });

  const TYPE_LABEL: Record<string, string> = { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from proceeds" };
  const TENURE_LABEL: Record<string, string> = { leasehold: "Leasehold", freehold: "Freehold" };
  const changes: string[] = [];
  if (input.newPurchaseType !== tx.purchaseType) {
    changes.push(`purchase type from ${TYPE_LABEL[tx.purchaseType ?? ""] ?? tx.purchaseType} to ${TYPE_LABEL[input.newPurchaseType]}`);
  }
  if (input.newTenure !== tx.tenure) {
    changes.push(`tenure from ${TENURE_LABEL[tx.tenure ?? ""] ?? tx.tenure} to ${TENURE_LABEL[input.newTenure]}`);
  }
  await logActivity(input.transactionId, `${session.user.name} updated ${changes.join(" and ")}`, session.user.id);

  revalidateTx(input.transactionId);
}

// Temporary internal-staff toggle: when set to true on a transaction, the
// buyer/seller portal confirmation email is skipped on milestone confirms.
// All other side effects of a confirm continue to fire. The toggle lives
// on the transaction (per-file), but only sales_progressor / admin /
// superadmin can change it via the UI. See docs/active/honest-chase-count
// area / the plan file for context.
export async function toggleSuppressPortalConfirmEmailsAction(
  transactionId: string,
  next: boolean,
  pathname: string,
): Promise<void> {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "sales_progressor" && role !== "admin" && role !== "superadmin") {
    throw new Error("Only internal staff can toggle the portal confirm email suppression.");
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(getAccessScope(session), transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: {
      suppressPortalConfirmEmails: next,
      suppressPortalConfirmEmailsSetAt: next ? new Date() : null,
      suppressPortalConfirmEmailsSetById: next ? session.user.id : null,
    },
  });

  revalidatePath(pathname, "page");
}

// ─── Phase 1 commit 6 — relist a withdrawn file with a new buyer ────────────
//
// LOCKED SPEC (Ellis, 2026-06-04):
//   - Single $transaction with EXACT step order
//   - fallThroughReason copied from tx → outgoing round BEFORE anything nulls it
//   - vendorMilestoneSnapshot JSON written on outgoing round BEFORE in-place reset
//   - Fire-and-forget intro email + reminder re-evaluation only AFTER commit
//
// ASSIGNMENT POLICY — CONTINUITY (Ellis decision, 2026-06-04, post-commit-8):
//   `assignedUserId`, `agentUserId`, `serviceType`, `assignedAt` are NOT
//   touched by relist. The SP (outsourced) or director (self-managed) who
//   had the file before keeps it. Reasoning, on the record:
//     Everything that persists through a relist is seller-side and
//     chain-side — exactly the institutional knowledge the assigned SP
//     holds. The assignment policy mirrors the reset map. Re-claim would
//     orphan a progressed file in the "Needs SP assigning" queue
//     overnight; a "send back to queue?" choice would surface a question
//     that should be right by default. Manual reassignment via
//     assignUserAction is still available for exceptions. A new bell
//     notification (notifyTransactionRelisted, fired post-commit) gives
//     the existing assignee the awareness re-claim was trying to buy.
//
// Preconditions (server-canonical — UI hides the CTA but the server is truth):
//   - tx.status === "withdrawn"
//   - tx.exchangedAt IS NULL                (a relist after exchange is not relist)
//   - tx.activeBuyerRoundId IS NOT NULL     (the round to archive must exist)
//   - Caller in agency scope (director/negotiator) OR internal staff (admin/SP/SA)
//   - Client portal tokens cannot reach this action — server actions require a
//     NextAuth session via requireSession()
//
// What the action does, in order:
//   1. Snapshot vendor VMs (the reset codes) onto outgoing round's
//      vendorMilestoneSnapshot column.
//   2. Carry tx.fallThroughReason → outgoing round.fallThroughReason.
//   3. Archive outgoing round (status=withdrawn, archivedAt=now).
//   4. Rotate old purchaser-contact portal tokens to NULL — belt-and-braces
//      so the new buyer's portal is unreachable from old links, even before
//      commit 5's round-mismatch guard kicks in.
//   5. Create the new BuyerRound (roundNumber+1, status=active) with the
//      buyer-side fields the caller supplied.
//   6. Reset VM2, VM7, VM10–VM20 in place — recompute state from current
//      prerequisites of the surviving (untouched) vendor milestones.
//   7. Create the new purchaser Contact stamped to the new round, with a
//      fresh portal token.
//   8. Initialize round-N+1 PMs (PM1–PM27) via inline createMany scoped
//      to the new round. Cannot use initializeMilestoneCompletions because
//      its "exists?" check is unscoped and would short-circuit on round-1 PMs.
//   9. Mirror buyer-side fields onto PropertyTransaction (purchasePrice,
//      purchaser solicitor, broker), flip status active, null fallThroughReason
//      + expectedExchangeDate + completionDate, point activeBuyerRoundId
//      at the new round.
//  10. Stamp a PriceHistory row on the new round if the price changed.
//  11. Cancel old round's pending ChaseTasks and outstanding ReminderLogs.
//  12. Clear chainLink.withdrawalStatus if set (file is back; no cascade).
//  13. Internal note — "X relisted to new buyer Y — Round N+1".
//
// Post-commit fire-and-forget:
//   - evaluateTransactionReminders(txId): rebuilds round-N+1 buyer-side
//     reminders AND vendor reminders anchored to the reset VM codes.
//   - sendOutsourceIntroForTransaction (outsourced files only): the
//     per-contact outsourceIntroSentAt dedup means the vendor (already
//     stamped at round 1) gets skipped; only the new buyer is emailed.
//
// Returns { newRoundId, newContactId } so the caller (UI in commit 6b, or
// the staging rehearsal) can route + verify.
//
// Reset-VM list — single source of truth, mirrors the BuyerRound schema
// comment on vendorMilestoneSnapshot.
const RELIST_RESET_VM_CODES = [
  "VM2", "VM7",
  "VM10", "VM11", "VM12", "VM13", "VM14", "VM15", "VM16", "VM17",
  "VM18", "VM19", "VM20",
  // Enquiries rework: VM21 ("all enquiries satisfied") is numerically outside
  // the VM10–VM20 range above, so it must be listed explicitly or it survives a
  // relist as complete — which would let the new buyer's seller exchange gate
  // open before their enquiries are even raised. resetStateFor derives it back
  // to locked from VM10.
  "VM21",
];

// EXCHANGE_GATE codes are special-cased in initializeMilestoneCompletions
// (always locked at init, "available" computed via gate logic at read time).
// Mirror that here so a reset doesn't put VM18 into a state inconsistent
// with how a fresh file would render it.
const RELIST_EXCHANGE_GATE_CODES = new Set(["VM18"]);

// Closed-loop chain arc (2026-06-05): the relist modal collects the new
// buyer's onward-sale status via a required radio step. The action turns
// that into one of four outcomes: nothing-to-do (first-time buyer),
// invite a fellow Sales Progressor agent, send a stub invite to an
// external agent, or flag chainSetupPending for the hub prompt.
export type OnwardSaleInput =
  | { kind: "none" }
  | { kind: "internal"; agentEmail: string }
  | { kind: "external"; agencyName: string; agentName: string; agentEmail: string }
  | { kind: "unknown" };

export async function relistTransactionAction(input: {
  transactionId: string;
  newBuyer: { name: string; email?: string | null; phone?: string | null };
  newPurchasePrice?: number | null;
  // Buyer's purchase method — required step in the relist modal (matches the
  // new-sale flow). The new buyer's method drives the auto-NR set on the
  // round's purchaser milestones (e.g. cash buyers skip mortgage steps), so
  // we MUST collect it at relist time rather than inheriting the previous
  // buyer's value. Omitted from older callers falls back to the existing
  // tx.purchaseType for backwards-compat.
  newPurchaseType?: PurchaseType | null;
  newPurchaserSolicitorFirmId?: string | null;
  newPurchaserSolicitorContactId?: string | null;
  newBrokerFirmId?: string | null;
  newBrokerContactId?: string | null;
  // Null when the file isn't in a chain (the modal hides the section).
  // Required when the file IS in a chain — server validates via the modal's
  // own gate, but defaults to "unknown" if a caller forgets (safety:
  // flagging chainSetupPending is better than silently leaving an
  // orphaned chain link untouched).
  onwardSale?: OnwardSaleInput | null;
}): Promise<{ newRoundId: string; newContactId: string; newRoundNumber: number }> {
  const session = await requireSession();
  return relistTransactionImpl(input, {
    userId: session.user.id,
    userName: session.user.name ?? "",
    agencyId: session.user.agencyId ?? null,
    scope: getAccessScope(session),
  });
}

// Inner implementation — the real work. Exported under an _Impl name so the
// staging rehearsal harness can drive it with a fixed test-user identity
// without standing up a NextAuth session. Production code MUST use
// relistTransactionAction; this _Impl form is for tooling only.
type RelistSessionLike = {
  userId: string;
  userName: string;
  agencyId: string | null;
  scope: ReturnType<typeof getAccessScope>;
};
export async function relistTransactionImpl(
  input: {
    transactionId: string;
    newBuyer: { name: string; email?: string | null; phone?: string | null };
    newPurchasePrice?: number | null;
    newPurchaseType?: PurchaseType | null;
    newPurchaserSolicitorFirmId?: string | null;
    newPurchaserSolicitorContactId?: string | null;
    newBrokerFirmId?: string | null;
    newBrokerContactId?: string | null;
    onwardSale?: OnwardSaleInput | null;
  },
  session: RelistSessionLike,
): Promise<{ newRoundId: string; newContactId: string; newRoundNumber: number }> {
  const scope = session.scope;
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      exchangedAt: true,
      activeBuyerRoundId: true,
      fallThroughReason: true,
      purchasePrice: true,
      tenure: true,
      purchaseType: true,
      serviceType: true,
      agencyId: true,
      agentUserId: true,
      assignedUserId: true,
      chainLinkId: true,
    },
  });
  if (!tx) throw new Error("Transaction not found");

  if (tx.status !== "withdrawn") {
    throw new Error(`Relist requires status=withdrawn (current: ${tx.status})`);
  }
  if (tx.exchangedAt !== null) {
    throw new Error("Cannot relist after exchange has happened");
  }
  if (tx.activeBuyerRoundId === null) {
    throw new Error("Cannot relist a file with no active buyer round");
  }
  if (!tx.tenure || !tx.purchaseType) {
    throw new Error("Cannot relist a file missing tenure or purchaseType");
  }

  // Outgoing round — needed for its roundNumber so the new round increments.
  const outgoingRound = await prisma.buyerRound.findUnique({
    where: { id: tx.activeBuyerRoundId },
    select: { id: true, roundNumber: true },
  });
  if (!outgoingRound) throw new Error("Outgoing round not found");
  const nextRoundNumber = outgoingRound.roundNumber + 1;

  // Definition lookups (read-only). We need:
  //   - Vendor reset def ids + codes for the snapshot + the reset writes
  //   - Vendor "preserved" def ids (untouched VMs) for prereq recompute
  //   - All purchaser-side def ids for the round-N+1 PM createMany
  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true },
  });
  const codeById = new Map(allDefs.map((d) => [d.id, d.code]));
  const idByCode = new Map(allDefs.map((d) => [d.code, d.id]));

  const resetVmDefIds = RELIST_RESET_VM_CODES
    .map((c) => idByCode.get(c))
    .filter((id): id is string => !!id);
  const purchaserDefIds = allDefs.filter((d) => d.side === "purchaser").map((d) => d.id);

  // Snapshot all vendor completions for the reset codes BEFORE the
  // transaction opens, so the snapshot reflects the state at the user's
  // moment of relist (and the JSON serialization happens outside the lock).
  // Vendor VMs are file-level (buyerRoundId IS NULL) — read accordingly.
  const vmRowsToSnapshot = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: tx.id,
      milestoneDefinitionId: { in: resetVmDefIds },
      buyerRoundId: null,
    },
    select: {
      id: true,
      milestoneDefinitionId: true,
      state: true,
      completedAt: true,
      completedById: true,
      eventDate: true,
      summaryText: true,
      reconciledAtExchange: true,
    },
  });
  const vendorMilestoneSnapshot = vmRowsToSnapshot.map((r) => ({
    code: codeById.get(r.milestoneDefinitionId) ?? "?",
    state: r.state,
    completedAt: r.completedAt?.toISOString() ?? null,
    completedById: r.completedById,
    eventDate: r.eventDate?.toISOString() ?? null,
    summaryText: r.summaryText,
    reconciledAtExchange: r.reconciledAtExchange,
  }));

  // Preserved vendor codes (untouched on relist) — used to recompute
  // post-reset state for the reset codes. We need their current state to
  // know whether each reset code becomes "available" or "locked".
  const preservedVmRows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: tx.id,
      milestoneDefinitionId: { in: allDefs.filter((d) => d.side === "vendor" && !RELIST_RESET_VM_CODES.includes(d.code)).map((d) => d.id) },
      buyerRoundId: null,
    },
    select: { milestoneDefinitionId: true, state: true },
  });
  const preservedStateByCode = new Map(
    preservedVmRows.map((r) => [codeById.get(r.milestoneDefinitionId) ?? "", r.state as string]),
  );

  // Recompute the reset codes' new state. Rule: prereqs all complete or
  // not_required → "available"; exchange gate → "locked" (gate logic adds
  // availability at render time); otherwise → "locked".
  function resetStateFor(code: string): "available" | "locked" {
    if (RELIST_EXCHANGE_GATE_CODES.has(code)) return "locked";
    const prereqs = DIRECT_PREREQUISITES[code] ?? [];
    if (prereqs.length === 0) return "available";
    // A reset code's prereq might be ANOTHER reset code (e.g. VM10's prereq
    // is VM7, both reset). After reset, the prereq goes to its OWN reset
    // state (available or locked). Recurse, with a guard for cycles
    // (the prerequisite graph is acyclic — this is just defensive).
    const allSatisfied = prereqs.every((p) => {
      if (RELIST_RESET_VM_CODES.includes(p)) {
        // Reset prereq: it's not yet "complete", so the dependent stays locked.
        return false;
      }
      const s = preservedStateByCode.get(p);
      return s === "complete" || s === "not_required";
    });
    return allSatisfied ? "available" : "locked";
  }
  const resetStateByCode = new Map<string, "available" | "locked">();
  for (const c of RELIST_RESET_VM_CODES) resetStateByCode.set(c, resetStateFor(c));

  // Old purchaser contacts whose tokens we'll rotate. Read outside the
  // transaction so the write inside is a simple updateMany.
  const oldPurchaserContacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: tx.id,
      roleType: "purchaser",
      buyerRoundId: outgoingRound.id,
    },
    select: { id: true },
  });

  // ───── Single $transaction — locked step order ─────────────────────────
  const result = await prisma.$transaction(async (ptx) => {
    // STEP 1: snapshot onto outgoing round.
    // STEP 2: carry fallThroughReason (BEFORE step in (9) nulls tx.fallThroughReason).
    // STEP 3: archive outgoing round.
    // STEPS 1+2+3 happen in a single update to keep the row write atomic
    // and to make the step ordering visible in the diff.
    await ptx.buyerRound.update({
      where: { id: outgoingRound.id },
      data: {
        vendorMilestoneSnapshot: vendorMilestoneSnapshot as object[],
        // STEP 2 — fallThroughReason carry, BEFORE the tx update nulls it.
        fallThroughReason: tx.fallThroughReason ?? null,
        status: "withdrawn",
        archivedAt: new Date(),
      },
    });

    // STEP 4 — old purchaser tokens are LEFT INTACT.
    //
    // Commit 5's round-mismatch guard already dead-routes the token at
    // every read site and the documents-upload write site, with the
    // DeadRoundNotice component rendered inside the portal shell so the
    // old buyer gets a friendly "this link is no longer active" page.
    // Nulling the token here would defeat that — the layout would render
    // notFound() instead of DeadRoundNotice, which is the inferior UX.
    //
    // Audit-preserved: the old contact + its (now-dead) round attribution
    // stays addressable, which keeps the round-1 history reachable by
    // contact id from internal tooling.
    void oldPurchaserContacts;

    // STEP 5 — create the new BuyerRound.
    const newRound = await ptx.buyerRound.create({
      data: {
        transactionId: tx.id,
        roundNumber: nextRoundNumber,
        status: "active",
        purchasePrice: input.newPurchasePrice ?? tx.purchasePrice,
        purchaserSolicitorFirmId: input.newPurchaserSolicitorFirmId ?? null,
        purchaserSolicitorContactId: input.newPurchaserSolicitorContactId ?? null,
        brokerFirmId: input.newBrokerFirmId ?? null,
        brokerContactId: input.newBrokerContactId ?? null,
      },
    });

    // STEP 6 — reset VM2 / VM7 / VM10–VM20 in place. Each reset row goes to
    // available or locked per the recompute above; completedAt/By/eventDate/
    // summaryText/reconciledAtExchange all clear. We update by row id, found
    // via the file-level scope (vendor rows are buyerRoundId IS NULL).
    const resetRows = await ptx.milestoneCompletion.findMany({
      where: {
        transactionId: tx.id,
        milestoneDefinitionId: { in: resetVmDefIds },
        buyerRoundId: null,
      },
      select: { id: true, milestoneDefinitionId: true },
    });
    for (const row of resetRows) {
      const code = codeById.get(row.milestoneDefinitionId) ?? "";
      const newState = resetStateByCode.get(code) ?? "locked";
      await ptx.milestoneCompletion.update({
        where: { id: row.id },
        data: {
          state: newState,
          completedAt: null,
          completedById: null,
          eventDate: null,
          expectedDate: null,
          summaryText: null,
          reconciledAtExchange: false,
          confirmedByPortal: false,
          outOfOrderCompletion: false,
          notRequiredReason: null,
        },
      });
    }

    // STEP 7 — create the new purchaser Contact, stamped to the new round.
    const newContact = await ptx.contact.create({
      data: {
        propertyTransactionId: tx.id,
        name: input.newBuyer.name,
        email: input.newBuyer.email ?? null,
        phone: input.newBuyer.phone ?? null,
        roleType: "purchaser",
        portalToken: randomUUID(),
        buyerRoundId: newRound.id,
      },
    });

    // STEP 8 — initialize the new round's PMs. Inline createMany scoped to
    // the new round (initializeMilestoneCompletions can't be used here: its
    // unscoped find-then-skip would short-circuit on round-1 PMs and create
    // nothing). Auto-NR codes + initial availability mirror the create flow.
    // Closed-loop chain arc (2026-06-05): the new buyer's purchaseType MAY
    // differ from the previous buyer's (cash buyer replaced a mortgaged
    // buyer, etc.). When supplied via the modal we use the NEW value so the
    // auto-NR set on this round's PMs matches the actual buyer; fallback to
    // tx.purchaseType for backwards-compat with older callers.
    const effectivePurchaseType = input.newPurchaseType ?? tx.purchaseType;
    const autoNrCodes = computeAutoNrCodes(effectivePurchaseType, tx.tenure);
    const initialAvailable = new Set<string>();
    for (const def of allDefs.filter((d) => d.side === "purchaser")) {
      if (autoNrCodes.has(def.code)) continue;
      const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
      // PM12's only prereq is VM9 (cross-side). The post-reset state of VM9
      // is preserved (VM9 is NOT in the reset list), so we read it from the
      // preserved map. Other PM prereqs are purchaser-side, all newly-created
      // → none "complete" yet, so dependent codes stay locked.
      const allSatisfied = prereqs.every((p) => {
        if (autoNrCodes.has(p)) return true;
        if (p.startsWith("VM")) {
          const s = preservedStateByCode.get(p);
          return s === "complete" || s === "not_required";
        }
        return false;
      });
      if (allSatisfied) initialAvailable.add(def.code);
    }
    const now = new Date();
    await ptx.milestoneCompletion.createMany({
      data: allDefs
        .filter((d) => d.side === "purchaser")
        .map((def) => {
          const isNr = autoNrCodes.has(def.code);
          const isAvail = initialAvailable.has(def.code);
          const state = isNr ? "not_required" : isAvail ? "available" : "locked";
          return {
            transactionId: tx.id,
            milestoneDefinitionId: def.id,
            state: state as "not_required" | "available" | "locked",
            notRequiredReason: isNr ? "Auto-set at file creation" : null,
            buyerRoundId: newRound.id,
            createdAt: now,
          };
        }),
    });

    // STEP 9 — mirror buyer-side fields onto PropertyTransaction + flip
    // status active + null tx.fallThroughReason / expectedExchangeDate /
    // completionDate. activeBuyerRoundId points at the new round.
    //
    // lastActivityAt bumped to now (Gap 1, 2026-06-04): every other
    // status-changing path bumps it (e.g. the /api/transactions/status
    // route) and downstream hub widgets sort by it. Without the bump,
    // the file's "last activity" stayed at the withdraw timestamp even
    // though we just relisted, mis-ranking it on the SP's queue.
    const updatedPrice = input.newPurchasePrice ?? tx.purchasePrice;
    // Pass 3 B8: default exchange forecast = relist + 12 weeks (the pacing
    // assumption baked into the progress formula). Replaces the previous null
    // write that left the forecast page blank until a milestone update.
    // Pass 3 B6: clear clientEmailsPaused — the toggle reflects a stance on
    // the previous buyer; it should not survive into the new sale. pausedAt /
    // pausedById are kept as historical audit; the boolean is the live flag.
    const forecastExpected = new Date(newRound.createdAt.getTime() + 84 * 86400000);
    await ptx.propertyTransaction.update({
      where: { id: tx.id },
      data: {
        status: "active",
        activeBuyerRoundId: newRound.id,
        fallThroughReason: null,
        expectedExchangeDate: forecastExpected,
        completionDate: null,
        purchasePrice: updatedPrice,
        // Closed-loop chain arc (2026-06-05): the new buyer's purchaseType
        // is the same value used to compute auto-NR codes above. Writing it
        // back ensures the file metadata matches the round's milestone tree.
        purchaseType: effectivePurchaseType,
        purchaserSolicitorFirmId: input.newPurchaserSolicitorFirmId ?? null,
        purchaserSolicitorContactId: input.newPurchaserSolicitorContactId ?? null,
        brokerFirmId: input.newBrokerFirmId ?? null,
        brokerContactId: input.newBrokerContactId ?? null,
        lastActivityAt: new Date(),
        clientEmailsPaused: false,
      },
    });

    // STEP 10 — PriceHistory row stamped to the new round if the price
    // changed. Mirrors savePriceAction.
    if (input.newPurchasePrice != null && input.newPurchasePrice !== tx.purchasePrice) {
      await ptx.priceHistory.create({
        data: {
          transactionId: tx.id,
          oldPrice: tx.purchasePrice,
          newPrice: input.newPurchasePrice,
          changedById: session.userId,
          buyerRoundId: newRound.id,
        },
      });
    }

    // STEP 11 — cancellation sweeps. THREE keys, run in series, all
    // updateMany updates with status="pending" filters so the writes are
    // idempotent and re-runs are safe.
    //
    // KEY 1 — round-keyed (the bread-and-butter): every pending ChaseTask
    // attributed to the outgoing round, regardless of target code. Catches
    // every buyer-side chase whose write site stamped buyerRoundId correctly.
    const cancelledKey1 = await ptx.chaseTask.updateMany({
      where: {
        transactionId: tx.id,
        buyerRoundId: outgoingRound.id,
        status: "pending",
      },
      data: { status: "cancelled" },
    });
    // KEY 2 — VM-code-keyed (vendor reset codes): VM rows are file-level
    // (buyerRoundId IS NULL by design). Cancel any reset-VM-anchored chase
    // so the engine recomputes against post-reset state.
    const cancelledKey2 = await ptx.chaseTask.updateMany({
      where: {
        transactionId: tx.id,
        buyerRoundId: null,
        status: "pending",
        reminderLog: {
          reminderRule: { targetMilestoneCode: { in: RELIST_RESET_VM_CODES } },
        },
      },
      data: { status: "cancelled" },
    });
    // KEY 3 — DEFENCE-IN-DEPTH: PM-code-keyed, regardless of buyerRoundId
    // stamp. Inside this $transaction the new round's PMs do not exist
    // yet (STEP 8 runs after STEP 11), and chase rebuild is fire-and-forget
    // AFTER commit — so every pending PM-targeted ChaseTask on the file
    // RIGHT NOW belongs to a previous buyer by definition. This sweep
    // catches engine-created rows that were written with buyerRoundId=NULL
    // by older code (pre-4c-followup) — without it, those rows survive
    // every relist sweep keyed on the stamp and can fire about a dead
    // buyer on a subsequent round.
    //
    // Also catches unstamped rows from any future write-site regression:
    // the cancellation is correct for ANY pending PM-targeted task at
    // this moment in the $transaction, no matter how it was written.
    const cancelledKey3 = await ptx.chaseTask.updateMany({
      where: {
        transactionId: tx.id,
        status: "pending",
        reminderLog: {
          reminderRule: { targetMilestoneCode: { startsWith: "PM" } },
        },
      },
      data: { status: "cancelled" },
    });
    // Parallel sweep on ReminderLog rows themselves: any "active" PM-targeted
    // log belongs to the outgoing buyer. Cancel so the engine's re-evaluation
    // (post-commit) can create fresh round-N+1 logs without colliding with
    // stale ones via the findFirst({status:"active"}) check.
    //
    // SEMANTIC ALIGNMENT (Phase-2 PR 1, Ellis-locked 2026-06-05): pre-2026-06-05
    // this used status="inactive", statusReason="Buyer round archived on relist".
    // Aligned to the plan's locked semantics: status="cancelled",
    // statusReason="sale fell through". Ships pre-launch — after prod has data
    // this rename would require a migration.
    const cancelledLogsResult = await ptx.reminderLog.updateMany({
      where: {
        transactionId: tx.id,
        status: "active",
        reminderRule: { targetMilestoneCode: { startsWith: "PM" } },
      },
      data: { status: "cancelled", statusReason: "sale fell through" },
    });

    // GAP-1 closure (Phase-2 PR 1, Ellis-locked: "if unsure: close"). Close
    // any open TransactionHoldPeriod rows at relist time, belt-and-braces
    // beyond the withdraw-side closure that changeStatusAction now does.
    // Idempotent via where endedAt IS NULL — a no-op if the withdraw step
    // already closed them.
    const holdsClosedResult = await ptx.transactionHoldPeriod.updateMany({
      where: { transactionId: tx.id, endedAt: null },
      data: { endedAt: new Date(), endedById: session.userId },
    });

    // STEP 12a — clear chainLink.withdrawalStatus if set. Closed-loop arc
    // (2026-06-05): the BUYER_FOUND cascade fires post-commit; the orphan
    // detachment from withdraw stays as-is (their split chain has its own
    // life now). We're only reactivating OUR link.
    if (tx.chainLinkId) {
      await ptx.chainLink.update({
        where: { id: tx.chainLinkId },
        data: { withdrawalStatus: null, withdrawalRespondedAt: null },
      });
    }

    // STEP 12b — closed-loop chain arc (2026-06-05): handle the new buyer's
    // onward sale per the modal's required radio step. Four paths:
    //   none     — first-time / cash buyer; chain ends below us; flag false
    //   internal — another SP agent's email; stub link at pos K-1 + invite
    //   external — external agency stub; stub link at pos K-1 + invite
    //   unknown  — chainSetupPending=true; hub prompt surfaces until cleared
    //   (skipped) — modal didn't render the section (file not in a chain);
    //               nothing to do.
    let onwardStubLinkId: string | null = null;
    let onwardInviteTargetEmail: string | null = null;
    if (tx.chainLinkId && input.onwardSale) {
      const onward = input.onwardSale;
      const ourLink = await ptx.chainLink.findUnique({
        where: { id: tx.chainLinkId },
        select: { chainId: true, position: true },
      });
      if (ourLink) {
        if (onward.kind === "unknown") {
          await ptx.propertyTransaction.update({
            where: { id: tx.id },
            data: { chainSetupPending: true },
          });
        } else if (onward.kind === "internal" || onward.kind === "external") {
          // Position K-1 — directly below us. The withdraw-side split
          // detached the prior K-1 into its own chain, so this slot is
          // free. Belt-and-braces: check for any pre-existing link at
          // that position before insert (defensive against a rare race
          // where two relists happen concurrently — last-write loses
          // the slot, but the chain stays consistent).
          const collision = await ptx.chainLink.findFirst({
            where: { chainId: ourLink.chainId, position: ourLink.position - 1 },
            select: { id: true },
          });
          if (!collision) {
            const stub = await ptx.chainLink.create({
              data: {
                chainId: ourLink.chainId,
                position: ourLink.position - 1,
                createdByUserId: session.userId,
                stubAgentEmail: onward.agentEmail,
                stubAgencyName: onward.kind === "external" ? onward.agencyName : null,
                stubAgentName: onward.kind === "external" ? onward.agentName : null,
                stubPropertyAddress: null, // we don't know the buyer's address yet
                inviteStatus: "NOT_SENT",
              },
              select: { id: true },
            });
            onwardStubLinkId = stub.id;
            onwardInviteTargetEmail = onward.agentEmail;
          }
        }
        // onward.kind === "none" → no-op (chain ends here; the existing
        // walker behaviour treats no-link-below as the same as a stub
        // with no claim).
      }
    }

    // STEP 13 — internal note.
    await ptx.outboundMessage.create({
      data: {
        transactionId: tx.id,
        type: "internal_note",
        contactIds: [newContact.id],
        content: `${session.userName} relisted this file with a new buyer (${input.newBuyer.name}) — Round ${nextRoundNumber}.${tx.fallThroughReason ? ` Previous round withdrew: ${tx.fallThroughReason}.` : ""}`,
        createdById: session.userId,
        buyerRoundId: newRound.id,
      },
    });

    return {
      newRoundId: newRound.id,
      newContactId: newContact.id,
      // Phase-2 PR 1: carry the cancellation counts out so the post-commit
      // event metadata can include them. Used only for the audit row at
      // the recordEvent call below — no behavioural consumer.
      cancellation: {
        cancelledChaseRoundKeyed: cancelledKey1.count,
        cancelledChaseVmKeyed: cancelledKey2.count,
        cancelledChasePmDefence: cancelledKey3.count,
        cancelledLogs: cancelledLogsResult.count,
        holdsClosed: holdsClosedResult.count,
      },
      // Closed-loop chain arc (2026-06-05): carry the new onward stub
      // link (if created) out so the post-commit BUYER_FOUND + invite
      // send paths can reference it without re-querying.
      onwardStubLinkId,
      onwardInviteTargetEmail,
    };
  });

  // ───── Post-commit reminder re-evaluation ──────────────────────────────
  // Rebuilds round-N+1 buyer-side schedule AND any vendor reminders whose
  // anchor was a reset VM code.
  //
  // 2026-07-13 fix (Chunk 1b): was fire-and-forget. Between commit and
  // this call finishing there was a window where the file's PM logs were
  // cancelled but round-N+1's fresh logs didn't yet exist - if the
  // reminder engine cron happened to scan during that window the file
  // could receive a rogue chase against the old buyer OR miss the
  // switchover entirely. Now awaited so the action doesn't return until
  // the switchover is complete. Failure here is logged but doesn't fail
  // the relist itself (the transaction has already committed and the
  // next scheduled cron run will self-heal).
  try {
    await evaluateTransactionReminders(tx.id);
  } catch (err) {
    console.error("[relist] reminder re-evaluation failed", err);
  }

  // STEP 12c — closed-loop chain arc (2026-06-05): BUYER_FOUND cascade
  // upward + chain-invite if the relist modal collected an onward agent.
  //
  // BUYER_FOUND walks the same upward path as the original LOST_BUYER,
  // sending per-response variant copy. Silent for WITHDRAW + BREAK_CHAIN
  // responders (per Ellis-lock 2026-06-05); fires for everyone else.
  //
  // Chain invite uses the existing sendChainInvite helper that powers
  // the chain-build flow, so external agents land in the same accept-
  // or-decline pipeline they would from a manual chain build. Internal
  // SP agents receive the same invite email — they accept via the
  // existing token flow and one of their files links to position K-1.
  if (tx.chainLinkId) {
    void cascadeChainBuyerFound(tx.chainLinkId).catch((err) => {
      console.error("[relist] BUYER_FOUND cascade failed", err);
    });
  }
  if (result.onwardStubLinkId && result.onwardInviteTargetEmail) {
    const inviteLinkId = result.onwardStubLinkId;
    void (async () => {
      try {
        const stubLink = await prisma.chainLink.findUnique({
          where: { id: inviteLinkId },
          select: {
            id: true,
            stubAgentEmail: true,
            stubAgentName: true,
            stubPropertyAddress: true,
            stubAgencyName: true,
            inviteStatus: true,
            inviteResendCount: true,
            chain: {
              select: {
                createdByUserId: true,
                links: {
                  select: {
                    position: true,
                    transactionId: true,
                    transaction: { select: { propertyAddress: true } },
                    stubPropertyAddress: true,
                  },
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        });
        if (stubLink && stubLink.stubAgentEmail) {
          await sendChainInvite({
            link: stubLink,
            sentByUserId: session.userId,
            sentByName: session.userName,
          });
        }
      } catch (err) {
        console.error("[relist] onward chain invite failed", err);
      }
    })();
  }

  // Intro email to the new buyer — outsourced only. The orchestrator's
  // per-contact outsourceIntroSentAt dedup means the vendor (already
  // stamped at round 1) gets skipped; only the new buyer receives.
  if (tx.serviceType === "outsourced") {
    const { sendOutsourceIntroForTransaction } = await import("@/lib/emails/send-outsource-intro");
    void sendOutsourceIntroForTransaction(tx.id, session.userId).catch((err) => {
      console.error("[relist] outsource intro send failed", err);
    });
  }

  // Bell + push to the existing file owner (continuity policy — see
  // banner comment at the top of the action). The intro email above
  // promises the new buyer a call within two working days; this bell
  // is what makes the email's promise keepable. LOCKED COPY — the
  // helpers carry the verbatim string from Ellis's voice pass.
  //
  // Recipient resolution:
  //   - outsourced files: assignedUserId (the SP). NULL = withdrawn
  //     before SP claim; skip gracefully (the file is in the unassigned
  //     queue already).
  //   - self-managed:     agentUserId. Should always be set; if not,
  //     skip silently rather than crash the post-commit chain.
  const recipientUserId = tx.serviceType === "outsourced"
    ? tx.assignedUserId
    : tx.agentUserId;
  if (recipientUserId) {
    void (async () => {
      try {
        const { notifyTransactionRelisted } = await import("@/lib/services/notifications");
        await notifyTransactionRelisted({
          userId: recipientUserId,
          transactionId: tx.id,
          propertyAddress: tx.propertyAddress,
          newBuyerName: input.newBuyer.name,
          newRoundNumber: nextRoundNumber,
        });
      } catch (err) {
        console.error("[relist] bell notification failed", err);
      }
    })();
    void (async () => {
      try {
        const { pushTransactionRelisted } = await import("@/lib/agent/push-events");
        await pushTransactionRelisted({
          recipientUserId,
          transactionId: tx.id,
          propertyAddress: tx.propertyAddress,
          newBuyerName: input.newBuyer.name,
          newRoundNumber: nextRoundNumber,
        });
      } catch (err) {
        console.error("[relist] web push failed", err);
      }
    })();
  }

  // Command Centre event log. Re-uses transaction_status_changed (withdrawn
  // → active) with a relisted=true marker rather than introducing a new
  // EventType enum value — keeps commit 6 schema-free. A dedicated
  // transaction_relisted event can be added later if Command Centre views
  // want to distinguish relist from a manual withdrawn→active flip.
  await recordEvent({
    type: "transaction_status_changed",
    agencyId: session.agencyId || undefined,
    userId: session.userId,
    entityType: "PropertyTransaction",
    entityId: tx.id,
    metadata: {
      from: "withdrawn",
      to: "active",
      relisted: true,
      previousRoundId: outgoingRound.id,
      newRoundId: result.newRoundId,
      newRoundNumber: nextRoundNumber,
      newBuyerName: input.newBuyer.name,
      priceChanged: input.newPurchasePrice != null && input.newPurchasePrice !== tx.purchasePrice,
      // Phase-2 PR 1: cancellation summary, mirrored shape to the withdraw
      // event metadata above so audit consumers can read both paths
      // uniformly. hookPoint discriminator lets the field tell whether the
      // cancellation actually caught anything at this hook (the withdraw
      // step usually catches first; this relist step is idempotent
      // belt-and-braces and typically reports counts of 0).
      cancellation: {
        hookPoint: "relist" as const,
        reason: "sale fell through",
        buyerRoundId: outgoingRound.id,
        cancelledChaseRoundKeyed: result.cancellation.cancelledChaseRoundKeyed,
        cancelledChaseVmKeyed: result.cancellation.cancelledChaseVmKeyed,
        cancelledChasePmDefence: result.cancellation.cancelledChasePmDefence,
        cancelledLogs: result.cancellation.cancelledLogs,
        holdsClosed: result.cancellation.holdsClosed,
      },
    },
  });

  // revalidatePath is only valid inside a request render context. Guard
  // for invocation from non-request callers (the staging rehearsal harness)
  // where the static generation store is absent.
  try {
    revalidatePath(`/agent/transactions/${tx.id}`);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("static generation store")) throw err;
  }
  return { newRoundId: result.newRoundId, newContactId: result.newContactId, newRoundNumber: nextRoundNumber };
}

// ─── acknowledgeRelistAction ─────────────────────────────────────────
// Hub card "New buyer added" → Acknowledge button. Stamps
// BuyerRound.relistAcknowledgedAt + relistAcknowledgedById on the
// supplied round. Idempotent — re-clicking is a no-op (the
// updateMany clause filters relistAcknowledgedAt IS NULL).
//
// Visibility: the SP assigned to the file (or any admin / internal
// staff in admin_all mode) can acknowledge. The scope check below
// rejects everything else with "Not found" — same pattern as the
// archived-round drawer's API route.
export async function acknowledgeRelistAction(roundId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const round = await prisma.buyerRound.findUnique({
    where: { id: roundId },
    select: { id: true, transactionId: true, relistAcknowledgedAt: true, roundNumber: true },
  });
  if (!round) throw new Error("Not found");
  if (round.roundNumber <= 1) throw new Error("Round 1 cannot be acknowledged (it was not relisted)");

  // Ownership check via the same scope helper used elsewhere.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, round.transactionId),
    select: { id: true, serviceType: true, assignedUserId: true },
  });
  if (!tx) throw new Error("Not found");
  if (tx.serviceType !== "outsourced") throw new Error("Acknowledgement only applies to outsourced files");
  // Already acknowledged? Idempotent no-op.
  if (round.relistAcknowledgedAt) return;

  await prisma.buyerRound.updateMany({
    where: { id: roundId, relistAcknowledgedAt: null },
    data: {
      relistAcknowledgedAt: new Date(),
      relistAcknowledgedById: session.user.id,
    },
  });
  try {
    revalidatePath("/agent/hub");
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("static generation store")) throw err;
  }
}

// Closed-loop chain arc (2026-06-05). Clears the chainSetupPending flag
// once the agent has either set up the new buyer's onward chain (via the
// chain widget on the file detail) OR confirmed there isn't one.
// Surfaced from the hub's "Complete chain setup" card AND a manual button
// on the file's chain widget. Idempotent.
export async function clearChainSetupPendingAction(transactionId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, chainSetupPending: true },
  });
  if (!tx) throw new Error("Not found");
  if (!tx.chainSetupPending) return; // idempotent

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { chainSetupPending: false },
  });

  try {
    revalidatePath("/agent/hub");
    revalidateTx(transactionId);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("static generation store")) throw err;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { createTransaction } from "@/lib/services/transactions";
import { createChainV2 } from "@/lib/services/chains";
import { sendChainInvite } from "@/lib/chain/invite";
import { evaluateTransactionReminders, createInitialRemindersInline } from "@/lib/services/reminders";
import { completeMilestone, initializeMilestoneCompletions, maybeUnlockExchangeGate } from "@/lib/services/milestones";
import { logActivity } from "@/lib/services/activity";
import { sendCompletionSurveys } from "@/lib/services/survey";
import { cascadeChainWithdrawal } from "@/lib/chain/withdrawal";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { computeAutoNrCodes, PURCHASE_TYPE_NR_CODES, FREEHOLD_NR_CODES } from "@/lib/milestone-auto-nr";
import { pushFileAssigned } from "@/lib/agent/push-events";
import { normaliseAddressString } from "@/lib/utils/address";
import { findFirstPairwiseConflict } from "@/lib/contacts/dedupe";
import type { TransactionStatus, PurchaseType, Tenure, ContactRole, MilestoneSide } from "@prisma/client";

type ContactInput = { name: string; phone?: string; email?: string; roleType: ContactRole };

const CHAIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      })),
    });
  }

  // Initialize all milestone completions (available/locked/not_required per tenure+purchaseType)
  if (input.tenure && input.purchaseType) {
    await initializeMilestoneCompletions(tx.id, input.tenure, input.purchaseType, session.user.id);
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

  // Fast inline creation: batch creates logs + tasks synchronously (~3 queries)
  const completedCodes = mosAutoConfirmed ? ["VM2", "PM2"] : [];
  await createInitialRemindersInline(tx.id, tx.createdAt, tx.assignedUserId, completedCodes).catch(console.error);
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
) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, status: true, chainLinkId: true },
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
    const gateCompletions = await prisma.milestoneCompletion.findMany({
      where: { transactionId, milestoneDefinitionId: { in: gateDefIds }, state: "complete" },
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

  await prisma.$transaction(async (ptx) => {
    await ptx.propertyTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        fallThroughReason: status === "withdrawn" ? (fallThroughReason ?? null) : null,
      },
    });
    if (enteringHold) {
      await ptx.transactionHoldPeriod.create({
        data: {
          transactionId,
          startedAt: new Date(),
          startedById: session.user.id,
          plannedEndAt: plannedEndAtDate,
        },
      });
    }
    if (leavingHold) {
      await ptx.transactionHoldPeriod.updateMany({
        where: { transactionId, endedAt: null },
        data: { endedAt: new Date(), endedById: session.user.id },
      });
    }
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
    await recordEvent({
      type: "transaction_archived",
      agencyId: session.user.agencyId || undefined,
      userId: session.user.id,
      entityType: "PropertyTransaction",
      entityId: transactionId,
      metadata: fallThroughReason ? { reason: fallThroughReason } : undefined,
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
    cascadeChainWithdrawal(tx.chainLinkId).catch(console.error);
  }

  revalidateTx(transactionId);
}

export async function savePriceAction(transactionId: string, purchasePrice: number) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, purchasePrice: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (tx.purchasePrice !== purchasePrice) {
    await prisma.priceHistory.create({
      data: { transactionId, oldPrice: tx.purchasePrice, newPrice: purchasePrice, changedById: session.user.id },
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

export async function saveOverrideDateAction(transactionId: string, overridePredictedDate: string | null) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { overridePredictedDate: overridePredictedDate ? new Date(overridePredictedDate) : null },
  });

  const dateStr = overridePredictedDate
    ? new Date(overridePredictedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
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
        ...(target === "self_managed"
          ? { assignedUserId: null, assignedAt: null }
          : {}),
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
  data: { brokerFirmId: string | null; brokerContactId: string | null; brokerReferralFee: number | null; brokerReferralFeeReceived: boolean }
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

  const [commCount, milestoneCount] = await Promise.all([
    prisma.outboundMessage.count({ where: { transactionId } }),
    prisma.milestoneCompletion.count({ where: { transactionId, state: "complete" } }),
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
      select: { id: true, chainLinkId: true },
    });
    if (!existing) throw new Error("Draft not found");

    await prisma.propertyTransaction.update({ where: { id: data.draftId }, data: scalarData });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: data.draftId } });
    if (allContacts.length > 0) {
      await prisma.contact.createMany({ data: allContacts.map((c) => ({ ...c, propertyTransactionId: data.draftId! })) });
    }
    await saveMosDocument(data.draftId);
    await saveChain(data.draftId, existing.chainLinkId);

    revalidatePath("/agent/transactions/new-v2");
    return { id: data.draftId };
  }

  // Create new draft
  const tx = await prisma.propertyTransaction.create({
    data: {
      ...scalarData,
      status: DRAFT_STATUS,
      agencyId: session.user.agencyId,
      agentUserId: session.user.id,
      progressedBy: data.progressedBy ?? "progressor",
      serviceType: (data.progressedBy ?? "progressor") === "progressor" ? "outsourced" : "self_managed",
    },
  });

  if (allContacts.length > 0) {
    await prisma.contact.createMany({ data: allContacts.map((c) => ({ ...c, propertyTransactionId: tx.id })) });
  }
  await saveMosDocument(tx.id);
  await saveChain(tx.id, null);

  revalidatePath("/agent/quick-add");
  revalidatePath("/agent/transactions/new-v2");
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
  });
  if (!draft) throw new Error("Draft not found");

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
      ...(data.progressedBy ? {
        progressedBy: data.progressedBy,
        serviceType: data.progressedBy === "progressor" ? "outsourced" : "self_managed",
      } : {}),
    },
  });

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
  revalidatePath("/agent/transactions/new-v2");
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

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId },
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

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId },
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
        where: { transactionId: input.transactionId, milestoneDefinitionId: def.id },
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
        where: { transactionId: input.transactionId, milestoneDefinitionId: def!.id },
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
        data: { status: "inactive", statusReason: "Marked not required — sale details changed" },
      });
    }

    // 6. Gate sync for each affected side
    for (const side of affectedSides) {
      const gateCode = side === "vendor" ? "VM18" : "PM25";
      const gateDef = defByCode.get(gateCode);
      if (!gateDef) continue;
      const gateDefId = gateDef!.id;

      const gateComp = await ptx.milestoneCompletion.findFirst({
        where: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId },
        select: { state: true },
      });
      if (!gateComp) continue;
      const gateState = gateComp!.state;
      if (gateState === "complete" || gateState === "not_required") continue;

      const blockers = allDefs.filter((d) => d.side === side && d.blocksExchange && d.code !== gateCode);
      const blockerComps = await ptx.milestoneCompletion.findMany({
        where: { transactionId: input.transactionId, milestoneDefinitionId: { in: blockers.map((b) => b.id) } },
        select: { milestoneDefinitionId: true, state: true },
      });
      const blockerMap = new Map(blockerComps.map((c) => [c.milestoneDefinitionId, c.state]));

      const allClear = blockers.every((b) => {
        const s = blockerMap.get(b.id);
        return s === "complete" || s === "not_required";
      });

      if (allClear && gateState === "locked") {
        const gateRow = await ptx.milestoneCompletion.findFirst({
          where: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId },
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
          where: { transactionId: input.transactionId, milestoneDefinitionId: gateDefId },
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

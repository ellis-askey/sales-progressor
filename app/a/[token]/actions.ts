"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { completeMilestone } from "@/lib/services/milestones";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { verifyAdvisorToken, type AdvisorSide } from "@/lib/advisor-confirm/token";
import { ADVISOR_CODES } from "@/lib/advisor-confirm/codes";
import { checkSolicitorConfirmLimit } from "@/lib/ratelimit";
import {
  sendAdminMilestoneNotificationToPortal,
  fireAutoCounterpartEmails,
  computeHandoffDirection,
  isBilateralCounterpartComplete,
} from "@/lib/services/portal";

// Everyone who should get a bell for an advisor's activity: the agency agent AND
// the assigned Sales Progressor (outsourced), de-duped. Mirrors the solicitor path.
function fileNotifyRecipients(tx: { agentUserId: string | null; assignedUserId: string | null }): string[] {
  return [...new Set([tx.agentUserId, tx.assignedUserId].filter((id): id is string => Boolean(id)))];
}

// Shared guard: re-verify the signed token on EVERY write, confirm the step is a
// mortgage step this advisor is actually asked about, and that it's available to
// confirm. Returns the matter + the broker we attribute the action to.
async function resolveStep(token: string, milestoneDefinitionId: string) {
  const decoded = verifyAdvisorToken(token);
  if (!decoded) throw new Error("This link is not valid.");
  // Phase 1/2 is buyer-side only.
  if (decoded.side !== "purchaser") throw new Error("This link is not valid.");

  const limit = await checkSolicitorConfirmLimit(token);
  if (!limit.success) throw new Error("Too many requests just now. Please wait a moment and try again.");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { id: true, code: true, side: true },
  });
  if (!def) throw new Error("That step could not be found.");

  const side: AdvisorSide = decoded.side;
  if (def.side !== "purchaser" || !(ADVISOR_CODES as readonly string[]).includes(def.code)) {
    throw new Error("That step is not part of this request.");
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      agencyId: true,
      agentUserId: true,
      assignedUserId: true,
      activeBuyerRoundId: true,
      suppressPortalConfirmEmails: true,
      brokerFirmId: true,
      brokerContactId: true,
      brokerFirm: { select: { name: true } },
      brokerContact: { select: { name: true } },
    },
  });
  if (!tx) throw new Error("This matter could not be found.");

  const stepScope = forRound(tx.activeBuyerRoundId, decoded.transactionId);
  const available = await prisma.milestoneCompletion.findFirst({
    where: { transactionId: decoded.transactionId, milestoneDefinitionId: def.id, state: "available", ...milestoneScopeWhere(stepScope) },
    select: { id: true },
  });
  if (!available) throw new Error("That step isn't ready to confirm yet.");

  const displayName = tx.brokerContact?.name ?? tx.brokerFirm?.name ?? "the mortgage advisor";
  return { decoded, def, tx, side, displayName, completionId: available.id };
}

export type AdvisorConfirmInput = {
  // PM6 only: the valuation date, OR desktop=true (no visit). One is required for PM6.
  eventDate?: string | null;
  desktop?: boolean;
  valuerName?: string | null;
  // PM11 only: the real mortgage-offer expiry (optional; clears the estimate).
  offerExpiry?: string | null;
  // Optional short note to the agency team (never shown to clients).
  note?: string | null;
};

export async function advisorConfirmStepAction(
  token: string,
  milestoneDefinitionId: string,
  input: AdvisorConfirmInput = {},
): Promise<{ ok: true }> {
  const { decoded, def, tx, displayName } = await resolveStep(token, milestoneDefinitionId);

  // PM6 captures the valuation date; a date is required unless it's a desktop
  // valuation. The physical-vs-desktop client email follows whether a date exists.
  let eventDate: Date | null | undefined;
  let pm6DateParam: string | null = null;
  if (def.code === "PM6") {
    if (input.desktop) {
      eventDate = null;
    } else {
      if (!input.eventDate) throw new Error("Please add the valuation date, or mark it a desktop valuation.");
      const d = new Date(input.eventDate);
      if (Number.isNaN(d.getTime())) throw new Error("Please choose a valid valuation date.");
      eventDate = d;
      pm6DateParam = input.eventDate;
    }
  }

  await completeMilestone({
    transactionId: decoded.transactionId,
    milestoneDefinitionId: def.id,
    confirmer: {
      kind: "advisor",
      firmId: tx.brokerFirmId,
      contactId: tx.brokerContactId,
      displayName,
    },
    eventDate,
  });

  // PM6: optional valuer/surveyor firm name, stored on the completion.
  if (def.code === "PM6" && input.valuerName?.trim()) {
    await prisma.propertyTransaction
      .update({ where: { id: decoded.transactionId }, data: { bookedValuerName: input.valuerName.trim() } })
      .catch(() => {});
  }

  // PM11: a real offer-expiry date from the advisor replaces the auto estimate.
  if (def.code === "PM11" && input.offerExpiry) {
    const exp = new Date(input.offerExpiry);
    if (!Number.isNaN(exp.getTime())) {
      await prisma.clientMoveInfo
        .upsert({
          where: { transactionId_side: { transactionId: decoded.transactionId, side: "purchaser" } },
          update: { mortgageOfferExpiry: exp, mortgageOfferExpiryApprox: false },
          create: { transactionId: decoded.transactionId, side: "purchaser", mortgageOfferExpiry: exp, mortgageOfferExpiryApprox: false },
        })
        .catch(() => {});
    }
  }

  // Client + team milestone emails — the existing fan-out, exactly as an agent or
  // solicitor confirm triggers. Suppressed per the file flag.
  if (!tx.suppressPortalConfirmEmails) {
    const counterpartComplete = await isBilateralCounterpartComplete(decoded.transactionId, def.code).catch(() => false);
    const handoffDirection = computeHandoffDirection(def.code, counterpartComplete);
    sendAdminMilestoneNotificationToPortal(decoded.transactionId, def.code, pm6DateParam, undefined, undefined, handoffDirection).catch(() => {});
    fireAutoCounterpartEmails(decoded.transactionId, def.code, undefined, undefined).catch(() => {});
  }

  // Optional team-only note.
  if (input.note?.trim()) {
    await writeAdvisorNote(tx, decoded.transactionId, def.code, displayName, input.note.trim());
  }

  revalidatePath(`/a/${token}`);
  return { ok: true };
}

// Leave a note (and/or an expected date) WITHOUT confirming the step — mirrors
// the solicitor "Add update" path. At least one of date/note is required.
export async function advisorUpdateStepAction(
  token: string,
  milestoneDefinitionId: string,
  expectedDate: string | null,
  note: string,
): Promise<{ ok: true }> {
  const trimmedNote = note.trim();
  const hasDate = !!expectedDate;
  if (!hasDate && !trimmedNote) throw new Error("Please add a date or a short update.");

  const { decoded, def, tx, displayName, completionId } = await resolveStep(token, milestoneDefinitionId);

  if (hasDate) {
    const date = new Date(expectedDate as string);
    if (Number.isNaN(date.getTime())) throw new Error("Please choose a valid date.");
    await prisma.milestoneCompletion.update({ where: { id: completionId }, data: { expectedDate: date } }).catch(() => {});
  }

  if (trimmedNote) {
    await writeAdvisorNote(tx, decoded.transactionId, def.code, displayName, trimmedNote);
  }

  revalidatePath(`/a/${token}`);
  return { ok: true };
}

async function writeAdvisorNote(
  tx: { agencyId: string; agentUserId: string | null; assignedUserId: string | null },
  transactionId: string,
  code: string,
  displayName: string,
  note: string,
): Promise<void> {
  const authorId = tx.agentUserId ?? tx.assignedUserId;
  if (!authorId) return;
  await prisma.outboundMessage.create({
    data: {
      transactionId,
      agencyId: tx.agencyId,
      type: "internal_note",
      method: "email",
      channel: "other",
      purpose: "chase",
      status: "sent",
      subject: `Update from ${displayName}`,
      content: note,
      senderLabel: displayName,
      contactIds: [],
      createdById: authorId,
      createdByRole: "director",
    },
  });
  const recipients = fileNotifyRecipients(tx);
  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: "advisor_update",
        transactionId,
        payload: { advisor: displayName, step: code, message: `${displayName} left an update: ${note}` },
      })),
    });
  }
}

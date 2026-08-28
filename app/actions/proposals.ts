"use server";

// Tier 3 stage 2 — approve/dismiss an AI proposal derived from an inbound email.
// Approve is the ONLY thing that acts: a "confirm" proposal runs completeMilestone
// and fires the client-facing emails exactly like a solicitor confirm; a "note"
// proposal logs an internal note. Nothing here runs without a human clicking.

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getAccessScope, canReadTransaction } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { completeMilestone } from "@/lib/services/milestones";
import { logCommAction } from "@/app/actions/comms";
import {
  sendAdminMilestoneNotificationToPortal,
  fireAutoCounterpartEmails,
  computeHandoffDirection,
  isBilateralCounterpartComplete,
  scheduleOrSendCompletionPack,
} from "@/lib/services/portal";
import { maybeSendReadyToExchangeEmail } from "@/lib/email/ready-to-exchange";

export async function approveProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; error: string; cleared?: boolean }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const p = await prisma.milestoneProposal.findUnique({ where: { id: proposalId } });
  if (!p || p.status !== "pending") return { ok: false, error: "Already handled." };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: p.transactionId },
    select: { id: true, agencyId: true, assignedUserId: true, agentUserId: true, suppressPortalConfirmEmails: true },
  });
  if (!tx || !canReadTransaction(scope, tx)) return { ok: false, error: "Forbidden" };

  if (p.actionType === "confirm" && p.milestoneDefinitionId && p.milestoneCode) {
    // Guard: if the step was completed elsewhere since this proposal was made,
    // don't re-complete or re-email. Mark the proposal superseded and say so.
    const already = await prisma.milestoneCompletion.findFirst({
      where: {
        transactionId: p.transactionId,
        milestoneDefinition: { code: p.milestoneCode },
        state: { in: ["complete", "not_required"] },
      },
      select: { id: true },
    });
    if (already) {
      await prisma.milestoneProposal.update({
        where: { id: p.id },
        data: { status: "superseded", decidedAt: new Date(), decidedById: session.user.id },
      });
      revalidatePath("/command/proposals");
      return { ok: false, cleared: true, error: "That step was already confirmed on the file, so nothing was sent. Cleared from your list." };
    }
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
    await completeMilestone({
      transactionId: p.transactionId,
      milestoneDefinitionId: p.milestoneDefinitionId,
      confirmer: { kind: "user", id: session.user.id, name: me?.name ?? "A colleague" },
    });
    // Same client-facing fan-out as an agent/solicitor confirm.
    if (!tx.suppressPortalConfirmEmails) {
      const code = p.milestoneCode;
      const counterpartComplete = await isBilateralCounterpartComplete(p.transactionId, code).catch(() => false);
      sendAdminMilestoneNotificationToPortal(p.transactionId, code, null, undefined, undefined, computeHandoffDirection(code, counterpartComplete)).catch(() => {});
      fireAutoCounterpartEmails(p.transactionId, code, undefined, undefined).catch(() => {});
      if (code === "VM19" || code === "PM26") scheduleOrSendCompletionPack(p.transactionId, code).catch(() => {});
      if (code === "VM18" || code === "PM25") maybeSendReadyToExchangeEmail(p.transactionId).catch(() => {});
    }
  } else if (p.actionType === "note") {
    await logCommAction({
      transactionId: p.transactionId,
      type: "internal_note",
      method: null,
      contactIds: [],
      content: `${p.noteText || p.summary}${p.emailFrom ? `\n\n(from ${p.emailFrom})` : ""}`,
      visibleToClient: false,
    });
  }

  await prisma.milestoneProposal.update({
    where: { id: p.id },
    data: { status: "approved", decidedAt: new Date(), decidedById: session.user.id },
  });
  revalidatePath("/command/proposals");
  return { ok: true };
}

export async function dismissProposalAction(
  proposalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const p = await prisma.milestoneProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, status: true, transactionId: true },
  });
  if (!p || p.status !== "pending") return { ok: false, error: "Already handled." };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: p.transactionId },
    select: { id: true, agencyId: true, assignedUserId: true, agentUserId: true },
  });
  if (!tx || !canReadTransaction(scope, tx)) return { ok: false, error: "Forbidden" };

  await prisma.milestoneProposal.update({
    where: { id: p.id },
    data: { status: "dismissed", decidedAt: new Date(), decidedById: session.user.id },
  });
  revalidatePath("/command/proposals");
  return { ok: true };
}

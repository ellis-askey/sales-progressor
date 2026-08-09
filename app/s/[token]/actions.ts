"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { completeMilestone } from "@/lib/services/milestones";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, type SolicitorSide } from "@/lib/solicitor-confirm/codes";

// Shared guard: re-verify the signed token on EVERY write (never trust the
// client) and confirm the step is one this side's solicitor is actually
// asked about. Returns the decoded matter + the milestone definition, plus
// the firm/contact we attribute the action to.
async function resolveStep(token: string, milestoneDefinitionId: string) {
  const decoded = verifySolicitorToken(token);
  if (!decoded) throw new Error("This link is not valid.");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { id: true, code: true, side: true },
  });
  if (!def) throw new Error("That step could not be found.");

  const side: SolicitorSide = decoded.side;
  // Two gates: the milestone's own side must match the link's side, AND the
  // code must be in the solicitor-owned set for that side. A tampered
  // milestoneDefinitionId therefore can't reach a step this link shouldn't touch.
  if (def.side !== side || !solicitorCodesForSide(side).has(def.code)) {
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
      vendorSolicitorFirmId: true,
      vendorSolicitorFirm: { select: { name: true } },
      vendorSolicitorContactId: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorFirm: { select: { name: true } },
      purchaserSolicitorContactId: true,
    },
  });
  if (!tx) throw new Error("This matter could not be found.");

  const firmName =
    side === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name;
  const solicitorFirmId =
    side === "vendor" ? tx.vendorSolicitorFirmId : tx.purchaserSolicitorFirmId;
  const solicitorContactId =
    side === "vendor" ? tx.vendorSolicitorContactId : tx.purchaserSolicitorContactId;

  return {
    decoded,
    def,
    tx,
    side,
    firmName: firmName ?? "the solicitor",
    solicitorFirmId,
    solicitorContactId,
  };
}

// (1) Confirm the step is done → flips the milestone to complete instantly,
// attributed to the firm (auditable; the agent can override on the file).
export async function solicitorConfirmStepAction(
  token: string,
  milestoneDefinitionId: string,
): Promise<{ ok: true }> {
  const { decoded, def, firmName, solicitorFirmId, solicitorContactId } = await resolveStep(
    token,
    milestoneDefinitionId,
  );

  await completeMilestone({
    transactionId: decoded.transactionId,
    milestoneDefinitionId: def.id,
    confirmer: {
      kind: "solicitor",
      firmId: solicitorFirmId,
      contactId: solicitorContactId,
      firmName,
    },
  });

  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// (2) Give an expected date → writes MilestoneCompletion.expectedDate without
// completing the step. Mirrors the client portal's "set a date" behaviour.
export async function solicitorSetExpectedDateAction(
  token: string,
  milestoneDefinitionId: string,
  expectedDate: string,
): Promise<{ ok: true }> {
  if (!expectedDate) throw new Error("Please choose a date.");
  const { decoded, def, tx, side } = await resolveStep(token, milestoneDefinitionId);

  const scope = forRound(tx.activeBuyerRoundId, decoded.transactionId);
  const existing = await prisma.milestoneCompletion.findFirst({
    where: {
      transactionId: decoded.transactionId,
      milestoneDefinitionId: def.id,
      ...milestoneScopeWhere(scope),
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.milestoneCompletion.update({
      where: { id: existing.id },
      data: { expectedDate: new Date(expectedDate) },
    });
  } else {
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: decoded.transactionId,
        milestoneDefinitionId: def.id,
        state: "available",
        expectedDate: new Date(expectedDate),
        buyerRoundId: side === "purchaser" ? tx.activeBuyerRoundId : null,
      },
    });
  }

  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// (3) Provide a written update → records an internal note on the file so the
// agent sees it in the file's activity. Attributed to the file's agent with a
// "[Solicitor update]" prefix (the solicitor isn't a system user).
export async function solicitorLeaveUpdateAction(
  token: string,
  milestoneDefinitionId: string,
  message: string,
): Promise<{ ok: true }> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Please type an update first.");
  const { decoded, def, tx, firmName } = await resolveStep(token, milestoneDefinitionId);

  const authorId = tx.agentUserId ?? tx.assignedUserId;
  if (authorId) {
    await prisma.outboundMessage.create({
      data: {
        transactionId: decoded.transactionId,
        agencyId: tx.agencyId,
        type: "internal_note",
        method: "email",
        channel: "other",
        purpose: "chase",
        status: "sent",
        subject: `Update from ${firmName}`,
        content: `[Solicitor update · ${def.code}] ${trimmed}`,
        contactIds: [],
        createdById: authorId,
        createdByRole: "director",
      },
    });
  }

  revalidatePath(`/s/${token}`);
  return { ok: true };
}

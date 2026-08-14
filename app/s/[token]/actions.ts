"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { completeMilestone } from "@/lib/services/milestones";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, type SolicitorSide } from "@/lib/solicitor-confirm/codes";
import { logEnquiryMovement, setEnquirySnoozeUntil } from "@/lib/enquiries/tracker";
import { markChaseResponded, recipientForSide } from "@/lib/enquiries/chase-log";
import { checkSolicitorConfirmLimit } from "@/lib/ratelimit";
import { maybeSendReadyToExchangeEmail } from "@/lib/email/ready-to-exchange";
import {
  sendAdminMilestoneNotificationToPortal,
  fireAutoCounterpartEmails,
  computeHandoffDirection,
  isBilateralCounterpartComplete,
  scheduleOrSendCompletionPack,
} from "@/lib/services/portal";

// Shared guard: re-verify the signed token on EVERY write (never trust the
// client) and confirm the step is one this side's solicitor is actually
// asked about. Returns the decoded matter + the milestone definition, plus
// the firm/contact we attribute the action to.
async function resolveStep(token: string, milestoneDefinitionId: string) {
  const decoded = verifySolicitorToken(token);
  if (!decoded) throw new Error("This link is not valid.");

  const limit = await checkSolicitorConfirmLimit(token);
  if (!limit.success) throw new Error("Too many requests just now. Please wait a moment and try again.");

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

  // Fire the client-facing milestone-confirmed emails, same as when the
  // agent ticks in-app. Without this, buyer/seller silently miss updates
  // whenever a solicitor confirms via /s/<token> — scope-doc line 5 said
  // "additive — clients keep getting their emails too", but the intent
  // wasn't wired until 2026-08-10.
  //
  // Fire-and-forget (.catch swallows) so a mail failure doesn't 500 the
  // solicitor's Confirm button. Respects tx.suppressPortalConfirmEmails
  // (internal debug toggle) via the tx lookup below.
  const txForEmail = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: { suppressPortalConfirmEmails: true },
  });
  if (txForEmail && !txForEmail.suppressPortalConfirmEmails) {
    const counterpartComplete = await isBilateralCounterpartComplete(
      decoded.transactionId,
      def.code,
    ).catch(() => false);
    const handoffDirection = computeHandoffDirection(def.code, counterpartComplete);
    // confirmerRoute is undefined — no user session in the solicitor flow.
    // Templates fall through to the default route copy (no skeleton-mode
    // route-variance for solicitor confirms; add if/when needed).
    sendAdminMilestoneNotificationToPortal(
      decoded.transactionId,
      def.code,
      null,
      undefined,
      undefined,
      handoffDirection,
    ).catch(() => {});

    // Auto-counterpart fan-out (VM19↔PM26, VM20↔PM27). No-op for other
    // codes. Included for correctness even though solicitors aren't asked
    // to confirm exchange/completion in v1 — safe defensive call.
    fireAutoCounterpartEmails(
      decoded.transactionId,
      def.code,
      undefined,
      undefined,
    ).catch(() => {});

    if (def.code === "VM19" || def.code === "PM26") {
      scheduleOrSendCompletionPack(decoded.transactionId, def.code).catch(() => {});
    }

    // Ready-to-exchange email (audit #10): when the solicitor just confirmed
    // an exchange gate, check whether both sides are now cleared and send the
    // one-off "ready to exchange" email. Dedups against the agent-confirm path.
    if (def.code === "VM18" || def.code === "PM25") {
      maybeSendReadyToExchangeEmail(decoded.transactionId).catch(() => {});
    }
  }

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

// Per-matter unsubscribe. The email footer's "stop these emails for this
// matter" link lands on /s/<token>/stop, which calls this to flip the
// solicitor pause flag for this side only. The chase cron reads that flag and
// stops sending; the confirm links themselves keep working. Reversible via the
// file's 4-toggle pause menu.
export async function solicitorStopEmailsAction(token: string): Promise<{ ok: true }> {
  const decoded = verifySolicitorToken(token);
  if (!decoded) throw new Error("This link is not valid.");
  const limit = await checkSolicitorConfirmLimit(token);
  if (!limit.success) throw new Error("Too many requests just now. Please wait a moment and try again.");
  await prisma.propertyTransaction.update({
    where: { id: decoded.transactionId },
    data:
      decoded.side === "vendor"
        ? { vendorSolicitorEmailsPaused: true }
        : { purchaserSolicitorEmailsPaused: true },
  });
  return { ok: true };
}

// ─── Enquiries loop (enquiries rework) ─────────────────────────────────────
//
// The enquiries stage is NOT one of the solicitor-owned milestone steps (it
// deliberately stays out of solicitorCodesForSide so the tracker owns the
// chase, not the reminder engine). These three actions let a solicitor act on
// the open EnquiryTracker straight from the same link: confirm enquiries
// satisfied (buyer's solicitor), reply with an update, or give an expected
// date. Each re-verifies the signed token and requires an OPEN tracker.

// Lighter guard for the enquiries panel: verify the token + rate limit + load
// the matter, and require an open (non-closed) EnquiryTracker. Unlike
// resolveStep this does NOT gate on solicitorCodesForSide, because the
// enquiries loop is tracked separately from the milestone steps.
async function resolveEnquiries(token: string) {
  const decoded = verifySolicitorToken(token);
  if (!decoded) throw new Error("This link is not valid.");

  const limit = await checkSolicitorConfirmLimit(token);
  if (!limit.success) throw new Error("Too many requests just now. Please wait a moment and try again.");

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      agencyId: true,
      agentUserId: true,
      assignedUserId: true,
      suppressPortalConfirmEmails: true,
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      enquiryTracker: { select: { id: true, closedAt: true } },
    },
  });
  if (!tx) throw new Error("This matter could not be found.");
  if (!tx.enquiryTracker || tx.enquiryTracker.closedAt) {
    throw new Error("The enquiries stage on this matter is not open.");
  }

  const side: SolicitorSide = decoded.side;
  const firmName =
    (side === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name) ?? "the solicitor";

  return { decoded, tx, side, firmName };
}

// (E1) Buyer's solicitor confirms all enquiries are satisfied → completes PM20.
// completeMilestone then closes the tracker and auto-completes the seller-side
// reflection VM21 (the reflection lives inside completeMilestone, so this path
// gets it for free). Only the buyer's solicitor can declare this — they raised
// the enquiries, so satisfaction is their call.
export async function solicitorEnquiriesSatisfiedAction(token: string): Promise<{ ok: true }> {
  const { decoded, tx, side } = await resolveEnquiries(token);
  if (side !== "purchaser") {
    throw new Error("Only the buyer's solicitor can confirm enquiries are satisfied.");
  }

  const pm20 = await prisma.milestoneDefinition.findFirst({
    where: { code: "PM20" },
    select: { id: true },
  });
  if (!pm20) throw new Error("That step could not be found.");

  // Completing PM20 auto-completes the seller-side reflection VM21 inside
  // completeMilestone (the reflection lives at that shared chokepoint so every
  // confirm path stays in sync). Wrap in a transaction so PM20 + VM21 land
  // together or not at all.
  await prisma.$transaction(async (ptx) => {
    await completeMilestone(
      {
        transactionId: decoded.transactionId,
        milestoneDefinitionId: pm20.id,
        confirmer: { kind: "solicitor", firmId: null, contactId: null, firmName: tx.purchaserSolicitorFirm?.name ?? "the solicitor" },
      },
      ptx,
    );
  }, { timeout: 30000, maxWait: 10000 });

  // Fire the client-facing "enquiries satisfied" email exactly as the agent's
  // in-app confirm would (PM20 → seller hears once; VM21 stays progressor-only
  // so it doesn't double up). Fire-and-forget so a mail failure can't 500.
  if (!tx.suppressPortalConfirmEmails) {
    sendAdminMilestoneNotificationToPortal(
      decoded.transactionId,
      "PM20",
      null,
      undefined,
      undefined,
      computeHandoffDirection("PM20", false),
    ).catch(() => {});
  }

  void markChaseResponded(decoded.transactionId, "buyer_solicitor", "confirm").catch(() => {});
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// (E2) Either solicitor leaves an update on the enquiries loop → records an
// accepted EnquiryMovement (source: solicitor_reply), which resets the 9-day
// chase clock and clears any stalled flag. A reply hands the ball to the other
// side. Also drops a bell notification so the agent sees it promptly.
export async function solicitorEnquiriesUpdateAction(token: string, message: string): Promise<{ ok: true }> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Please type an update first.");
  const { decoded, tx, side, firmName } = await resolveEnquiries(token);

  // A reply from one side moves the ball to the other side's court.
  const flipsCourtTo = side === "vendor" ? "buyer_solicitor" : "seller_solicitor";

  const logged = await logEnquiryMovement({
    transactionId: decoded.transactionId,
    note: trimmed,
    flipsCourtTo,
    source: "solicitor_reply",
  });
  if (!logged) throw new Error("The enquiries stage on this matter is not open.");

  const authorId = tx.agentUserId ?? tx.assignedUserId;
  if (authorId) {
    await prisma.notification.create({
      data: {
        userId: authorId,
        type: "solicitor_update",
        transactionId: decoded.transactionId,
        payload: {
          firmName,
          step: "enquiries",
          message: `${firmName} left an enquiries update: ${trimmed}`,
        },
      },
    });
  }

  void markChaseResponded(decoded.transactionId, recipientForSide(side), "update").catch(() => {});
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// (E3) Either solicitor gives an expected date for the enquiries → snoozes the
// tracker chase until that date (we hold off nudging over a date they've
// committed to) and records it on the loop so it's visible on the file.
export async function solicitorEnquiriesExpectedDateAction(token: string, expectedDate: string): Promise<{ ok: true }> {
  if (!expectedDate) throw new Error("Please choose a date.");
  const { decoded, side } = await resolveEnquiries(token);

  const date = new Date(expectedDate);
  if (Number.isNaN(date.getTime())) throw new Error("Please choose a valid date.");
  // Reject a past date up front: otherwise the snooze can't apply (we never hold
  // off to a date already gone) yet the movement below would still reset the
  // chase clock — backing off 9 days on a date that means nothing.
  if (date.getTime() <= Date.now()) throw new Error("Please choose a date in the future.");

  await setEnquirySnoozeUntil(decoded.transactionId, date);

  // Record it on the loop (no court flip — a promised date isn't a reply). This
  // also resets the chase clock, consistent with the snooze.
  const uk = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const who = side === "vendor" ? "seller's solicitor" : "buyer's solicitor";
  await logEnquiryMovement({
    transactionId: decoded.transactionId,
    note: `Expected by ${uk} (${who})`,
    source: "solicitor_reply",
  });

  void markChaseResponded(decoded.transactionId, recipientForSide(side), "date").catch(() => {});
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// ── Raise-enquiries chase (enquiries rework) ─────────────────────────────────
// Before the enquiries loop begins, the buyer's solicitor can confirm they've
// raised enquiries, or give a date, straight from the raise-chase email link.
// Requires an OPEN EnquiryRaiseChase (the pre-loop chase).

async function resolveRaise(token: string) {
  const decoded = verifySolicitorToken(token);
  if (!decoded) throw new Error("This link is not valid.");
  const limit = await checkSolicitorConfirmLimit(token);
  if (!limit.success) throw new Error("Too many requests just now. Please wait a moment and try again.");
  if (decoded.side !== "purchaser") {
    throw new Error("Only the buyer's solicitor can confirm enquiries have been raised.");
  }
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      activeBuyerRoundId: true,
      suppressPortalConfirmEmails: true,
      purchaserSolicitorFirm: { select: { name: true } },
      enquiryRaiseChase: { select: { closedAt: true } },
    },
  });
  if (!tx) throw new Error("This matter could not be found.");
  if (!tx.enquiryRaiseChase || tx.enquiryRaiseChase.closedAt) {
    throw new Error("This matter is not waiting on enquiries to be raised.");
  }
  return { decoded, tx };
}

// (R1) Confirm enquiries have been raised → completes PM14, which closes the
// raise chase and opens the enquiries tracker (the reply loop begins).
export async function solicitorRaisedConfirmAction(token: string): Promise<{ ok: true }> {
  const { decoded, tx } = await resolveRaise(token);
  const pm14 = await prisma.milestoneDefinition.findFirst({ where: { code: "PM14" }, select: { id: true } });
  if (!pm14) throw new Error("That step could not be found.");

  await completeMilestone({
    transactionId: decoded.transactionId,
    milestoneDefinitionId: pm14.id,
    confirmer: { kind: "solicitor", firmId: null, contactId: null, firmName: tx.purchaserSolicitorFirm?.name ?? "the solicitor" },
  });

  // Fire the client-facing "enquiries raised" email, same as any PM14 confirm.
  if (!tx.suppressPortalConfirmEmails) {
    sendAdminMilestoneNotificationToPortal(
      decoded.transactionId, "PM14", null, undefined, undefined, computeHandoffDirection("PM14", false),
    ).catch(() => {});
  }

  void markChaseResponded(decoded.transactionId, "buyer_solicitor", "confirm").catch(() => {});
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// (R2) Give an expected "raised by" date → stored on the PM14 step; the raise
// chase holds off until then.
export async function solicitorRaisedExpectedDateAction(token: string, expectedDate: string): Promise<{ ok: true }> {
  if (!expectedDate) throw new Error("Please choose a date.");
  const { decoded, tx } = await resolveRaise(token);
  const date = new Date(expectedDate);
  if (Number.isNaN(date.getTime())) throw new Error("Please choose a valid date.");
  if (date.getTime() <= Date.now()) throw new Error("Please choose a date in the future.");

  const pm14 = await prisma.milestoneDefinition.findFirst({ where: { code: "PM14" }, select: { id: true } });
  if (!pm14) throw new Error("That step could not be found.");
  const scope = forRound(tx.activeBuyerRoundId, decoded.transactionId);
  const existing = await prisma.milestoneCompletion.findFirst({
    where: { transactionId: decoded.transactionId, milestoneDefinitionId: pm14.id, ...milestoneScopeWhere(scope) },
    select: { id: true },
  });
  if (existing) {
    await prisma.milestoneCompletion.update({ where: { id: existing.id }, data: { expectedDate: date } });
  } else {
    await prisma.milestoneCompletion.create({
      data: { transactionId: decoded.transactionId, milestoneDefinitionId: pm14.id, state: "available", expectedDate: date, buyerRoundId: tx.activeBuyerRoundId },
    });
  }

  void markChaseResponded(decoded.transactionId, "buyer_solicitor", "date").catch(() => {});
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
    // Internal note on the file's activity feed…
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
    // …and a bell notification so the assigned agent sees it promptly.
    await prisma.notification.create({
      data: {
        userId: authorId,
        type: "solicitor_update",
        transactionId: decoded.transactionId,
        payload: {
          firmName,
          step: def.code,
          message: `${firmName} left an update: ${trimmed}`,
        },
      },
    });
  }

  revalidatePath(`/s/${token}`);
  return { ok: true };
}

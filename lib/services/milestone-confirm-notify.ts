// Outbound notifications for a SINGLE confirmed milestone.
//
// This is the exact set of client/agent notifications the Steps-tab confirm
// (`confirmMilestoneAction` in app/actions/milestones.ts) fires for the
// milestone that was just confirmed: the portal milestone email, ready-to-
// exchange email, completion pack, first-exchange retention email, the push
// notification, and the SP bell. It exists so other confirm entry points
// (the Reminders "Done" button — reminders page, in-file reminders tab, work
// queue, next-action card, all via completeTaskAction) send the SAME emails
// the Steps tab does, instead of silently completing the step with no client
// notification.
//
// PARITY NOTE: confirmMilestoneAction keeps its own inline copy of this block
// (deliberately left untouched so the Steps-tab path can't regress). If you
// change the notification set here, mirror it there — and vice versa. Tracked
// in docs/POLISH_TBD.md for a future unification.
//
// It does NOT complete any milestone, touch reminders, or change transaction
// status — callers own that. It is purely the "tell people" step.

import { prisma } from "@/lib/prisma";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { pushToTransaction } from "@/lib/services/push";
import {
  sendAdminMilestoneNotificationToPortal,
  computeHandoffDirection,
  isBilateralCounterpartComplete,
  roleToConfirmerRoute,
  fireAutoCounterpartEmails,
  scheduleOrSendCompletionPack,
} from "@/lib/services/portal";
import { maybeFireFirstExchangeEmail } from "@/lib/services/retention";
import { notifyOutsourcedMilestoneConfirmed } from "@/lib/services/notifications";
import { maybeSendReadyToExchangeEmail } from "@/lib/email/ready-to-exchange";

export async function sendMilestoneConfirmationNotifications(input: {
  transactionId: string;
  milestoneCode: string;
  // The real-world date the step happened, when captured (exchange/completion
  // date prompt). Null for the everyday one-click confirms.
  eventDate: string | null;
  confirmerUserId: string;
  confirmerName: string | null;
  confirmerRole: string;
  // Steps-tab confirms complete the bilateral counterpart (VM19↔PM26,
  // VM20↔PM27) in the same DB transaction, so they also fire the counterpart's
  // customer email. A Reminders "Done" completes ONLY the clicked milestone, so
  // it must pass false — the counterpart's own reminder fires its email when it
  // is confirmed. Passing true when the counterpart isn't actually complete
  // would email that side prematurely.
  includeCounterpartEmail: boolean;
}): Promise<void> {
  const {
    transactionId,
    milestoneCode: code,
    eventDate,
    confirmerUserId,
    confirmerName,
    confirmerRole,
    includeCounterpartEmail,
  } = input;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      serviceType: true,
      assignedUserId: true,
      suppressPortalConfirmEmails: true,
      isDemo: true,
    },
  });
  // Demo files emit nothing outbound (mirrors confirmMilestoneAction's
  // `if (def && !tx.isDemo)` guard).
  if (!tx || tx.isDemo) return;

  const label = getMilestoneCopy(code).label;
  const short = tx.propertyAddress.split(",")[0];

  // Push copy — identical strings + precedence to the Steps-tab block.
  let title = "One step closer";
  let body = `${label}, done at ${short}.`;
  if (code === "VM19" || code === "PM26") {
    title = "Contracts exchanged!";
    body = `${short}. The sale is now legally binding. Congratulations.`;
  } else if (code === "VM20" || code === "PM27") {
    title = "It's completed!";
    body = `${short} is yours. Congratulations on your move.`;
  } else if (code === "VM18" || code === "PM25") {
    title = "Ready to exchange";
    body = `Everything's in place at ${short}. Exchange is next.`;
  } else if (eventDate) {
    const fmtDate = new Date(eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    title = `Date confirmed: ${short}`;
    body = `${label} booked for ${fmtDate}`;
  }

  pushToTransaction(transactionId, { title, body, urlPath: "/progress" }).catch(() => {});

  // Ready-to-exchange email: fires only when BOTH gates are now cleared (the
  // helper re-checks and dedups).
  if (code === "VM18" || code === "PM25") {
    maybeSendReadyToExchangeEmail(transactionId).catch(() => {});
  }

  const confirmerRoute = roleToConfirmerRoute(confirmerRole);
  const counterpartComplete = await isBilateralCounterpartComplete(transactionId, code).catch(() => false);
  const handoffDirection = computeHandoffDirection(code, counterpartComplete);

  // Per-transaction debug toggle: internal staff can suppress the client-facing
  // confirm email while keeping the internal side-effects.
  if (!tx.suppressPortalConfirmEmails) {
    sendAdminMilestoneNotificationToPortal(
      transactionId,
      code,
      eventDate,
      confirmerUserId,
      confirmerRoute,
      handoffDirection,
    ).catch(() => {});

    if (includeCounterpartEmail) {
      fireAutoCounterpartEmails(transactionId, code, confirmerUserId, confirmerRoute).catch(() => {});
    }

    // Completion-pack ("what to expect on completion day") scheduling for
    // exchange confirmations only.
    if (code === "VM19" || code === "PM26") {
      scheduleOrSendCompletionPack(transactionId, code).catch(() => {});
    }
  }

  // Retention: first-exchange celebration for the confirming user.
  if (code === "VM19" || code === "PM26") {
    maybeFireFirstExchangeEmail(confirmerUserId, transactionId).catch(() => {});
  }

  // SP bell: when an agency-side user confirms on an outsourced file, ping the
  // assigned Sales Progressor. Skipped when the confirmer IS the SP.
  const isAgencyRole =
    confirmerRole === "director" || confirmerRole === "negotiator" || confirmerRole === "viewer";
  if (
    tx.serviceType === "outsourced" &&
    tx.assignedUserId &&
    tx.assignedUserId !== confirmerUserId &&
    isAgencyRole
  ) {
    notifyOutsourcedMilestoneConfirmed({
      spUserId: tx.assignedUserId,
      transactionId,
      confirmerName: confirmerName ?? "An agent",
      milestoneLabel: label,
      milestoneCode: code,
    }).catch(() => {});
  }
}

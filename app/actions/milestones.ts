"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import type { PurchaseType } from "@prisma/client";
import {
  completeMilestone,
  markNotRequiredWithCascade,
  reverseMilestoneWithCascade,
  getUndoImpact,
  executeUndoMilestone,
  unlockDirectDependents,
  maybeUnlockExchangeGate,
} from "@/lib/services/milestones";
export type { UndoImpact, UndoImpactItem } from "@/lib/services/milestones";
import { pushToTransaction } from "@/lib/services/push";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  sendAdminMilestoneNotificationToPortal,
  computeHandoffDirection,
  isBilateralCounterpartComplete,
  roleToConfirmerRoute,
  fireAutoCounterpartEmails,
  scheduleOrSendCompletionPack,
} from "@/lib/services/portal";
import { getDisplayName } from "@/lib/contacts/displayName";
import { maybeFireFirstExchangeEmail } from "@/lib/services/retention";
import { notifyOutsourcedMilestoneConfirmed } from "@/lib/services/notifications";
import { evaluateTransactionReminders, autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import { recordEvent } from "@/lib/command/events/write";

export type NotificationStatus = {
  role: "seller" | "buyer" | "agent" | "progressor";
  contactId: string | null;
  contactDisplayName: string;
  status: "queued" | "skipped_no_email" | "skipped_no_contact";
};

/**
 * Confirm a milestone (and any implied predecessors) for a transaction.
 * Equivalent to POST /api/milestones { action: "complete" } but runs as a
 * Server Action so Next.js automatically invalidates the Router Cache and
 * re-renders the page without a client-side router.refresh().
 *
 * The Route Handler at /api/milestones is kept alive for non-React callers.
 * Both paths call the same service functions — no business logic here.
 */
export async function confirmMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, propertyAddress: true, serviceType: true, assignedUserId: true, suppressPortalConfirmEmails: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });

  // Resolve counterpart definition id before the transaction (read-only lookup)
  const BILATERAL_PAIRS: Record<string, string> = {
    VM19: "PM26", PM26: "VM19",
    VM20: "PM27", PM27: "VM20",
  };
  const counterCode = def?.code ? BILATERAL_PAIRS[def.code] : undefined;
  let counterDefId: string | undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id;
  }

  // Primary + bilateral counterpart writes in a single atomic transaction.
  //
  // Prereq-gate UX (2026-06-05): completeMilestone throws a structured
  // `PREREQUISITES_NOT_COMPLETE` Error with { targetCode, missing } when
  // the user clicks Confirm on a milestone whose direct prereqs aren't yet
  // committed (the rapid-click race surfaced on 14 Cedar Green when VM5 was
  // clicked 6s after VM4). In production, Next.js wraps thrown Server
  // Action errors in a generic digest message — the structured `missing`
  // payload is stripped before it reaches the client, so the row would
  // show a useless "An error occurred in the Server Components render"
  // line. Catch that specific error here and convert it to a discriminated
  // failure return; the client can render "Confirm '<missing>' first."
  const confirmer = { kind: "user" as const, id: session.user.id, name: session.user.name ?? "" };
  let result;
  try {
    result = await prisma.$transaction(async (ptx) => {
    const primary = await completeMilestone({
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      confirmer,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    }, ptx);

    if (counterDefId) {
      const txRowForScope = await ptx.propertyTransaction.findUnique({
        where: { id: input.transactionId },
        select: { activeBuyerRoundId: true },
      });
      const scope = forRound(txRowForScope?.activeBuyerRoundId ?? null, input.transactionId);
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          state: "complete",
          ...milestoneScopeWhere(scope),
        },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          confirmer,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        }, ptx);
      }
    }

    // Exchange Forecast sync: lock in confirmed exchange date
    if ((def?.code === "VM19" || def?.code === "PM26") && input.eventDate) {
      await ptx.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { expectedExchangeDate: new Date(input.eventDate) },
      });
    }

    return primary;
    }, {
      // Default 5s is too tight: completeMilestone fans out 6-10 queries per call
      // and bilateral VM19/PM26 doubles that. Pass 3b/3c + reminder-gate (f325046)
      // pushed staging over the budget; the failure was P2028 on the side-effect
      // chain reads. 30s gives the bilateral pair clear runway without changing
      // semantics. See Vercel runtime log digest 1190048595 (2026-06-07).
      timeout: 30000,
      maxWait: 10000,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "PREREQUISITES_NOT_COMPLETE") {
      const e = err as Error & { targetCode?: string; missing?: { code: string; name: string }[] };
      return {
        ok: false as const,
        kind: "prereqs_missing" as const,
        targetCode: e.targetCode,
        missing: e.missing ?? [],
      };
    }
    throw err;
  }

  // 2026-07-13 fix (Chunk 2a): sync re-eval so any reminder rules that
  // were dormant waiting on this milestone's eventDate (typically a
  // rule anchored on it with useEventDate=true) wake up immediately.
  // Previously deferred to the 04:00 cron - so if an agent set the
  // eventDate on confirmation and expected the follow-up chases to
  // start, they'd see nothing happen until the next day.
  await evaluateTransactionReminders(input.transactionId).catch((err) => {
    console.error("[confirmMilestoneAction] reminder re-eval failed", err);
  });

  // Single revalidate after all DB writes (primary + bilateral counterpart)
  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");
  void trackServerEvent(session.user.id, ANALYTICS_EVENTS.MILESTONE_CONFIRMED, {
    transactionId: input.transactionId,
    milestoneId:   input.milestoneDefinitionId,
    milestoneCode: def?.code ?? undefined,
    agencyId:      session.user.agencyId || undefined,
  });

  // Completion: sync the transaction completionDate if the confirmed date differs
  if ((def?.code === "VM20" || def?.code === "PM27") && input.eventDate) {
    try {
    const actualDate = new Date(input.eventDate);
    const txData = await prisma.propertyTransaction.findFirst({
      where: { id: input.transactionId },
      select: { completionDate: true },
    });
    const existingDate = txData?.completionDate;
    const dateMismatch = !existingDate ||
      Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000; // >12h apart
    if (dateMismatch) {
      await prisma.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { completionDate: actualDate },
      });
      revalidateTx(input.transactionId);
    }
    } catch (err) {
      console.error("[confirmMilestoneAction] completionDate sync failed:", err);
    }
  }

  // Auto-flip tx.status to "completed" once both completion milestones land.
  // Triggered after VM20 or PM27 confirms (the bilateral counterpart auto-
  // completes inside the prisma.$transaction above, so by the time we get
  // here both rows are already in the DB on a normal happy-path confirm).
  // Without this the file is stuck at status="active" indefinitely — agents
  // had to remember to flip status manually from the StatusControl, and
  // forgetting hides the file from the Completed tab. Surfaced 2026-06-19
  // on 14-16 Wellcroft, Ivinghoe (cmpmgy87f005kdqf0ei7k0d3t — completed
  // 16 Jun, still "active" on 19 Jun) and 11 Muad Janes Close, same date.
  //
  // Status preconditions: only flip from "active". Withdrawn is terminal
  // (file failed); on_hold means the agent paused deliberately and must
  // re-activate first (locked decision 2026-06-19). Already-completed is
  // an idempotent no-op.
  if (def?.code === "VM20" || def?.code === "PM27") {
    try {
      const flipTx = await prisma.propertyTransaction.findUnique({
        where: { id: input.transactionId },
        select: { id: true, status: true, activeBuyerRoundId: true, agencyId: true },
      });
      if (flipTx && flipTx.status === "active") {
        // Round-scoped completion check — same shape as the manual gate
        // in updateTransactionStatus (app/actions/transactions.ts ~line
        // 488-505). Vendor VMs are file-level (buyerRoundId IS NULL);
        // PM27 belongs to the active round.
        const flipScope = forRound(flipTx.activeBuyerRoundId ?? null, input.transactionId);
        const completionDefs = await prisma.milestoneDefinition.findMany({
          where: { code: { in: ["VM20", "PM27"] } },
          select: { id: true, code: true },
        });
        const completed = await prisma.milestoneCompletion.findMany({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: { in: completionDefs.map((d) => d.id) },
            state: "complete",
            ...milestoneScopeWhere(flipScope),
          },
          select: { milestoneDefinitionId: true },
        });
        const completedDefIds = new Set(completed.map((c) => c.milestoneDefinitionId));
        const vm20Def = completionDefs.find((d) => d.code === "VM20");
        const pm27Def = completionDefs.find((d) => d.code === "PM27");
        const bothComplete = !!(vm20Def && pm27Def && completedDefIds.has(vm20Def.id) && completedDefIds.has(pm27Def.id));

        if (bothComplete) {
          await prisma.propertyTransaction.update({
            where: { id: input.transactionId },
            data: { status: "completed" },
          });

          // Activity-feed line, voice-passed against docs/reference/VOICE.md
          // (passive past tense for celebratory news; no system self-
          // references; no milestone codes user-facing; "both parties" is
          // the established phrase for vendor+purchaser pair).
          await prisma.outboundMessage.create({
            data: {
              transactionId: input.transactionId,
              type: "internal_note",
              contactIds: [],
              content: "Marked as completed. Both parties have confirmed.",
              createdById: session.user.id,
            },
          });

          // Command Centre event log — mirror the manual-flip path so
          // analytics/dashboards see a single coherent stream of status
          // changes. The trigger metadata distinguishes auto from manual.
          await recordEvent({
            type: "transaction_status_changed",
            agencyId: flipTx.agencyId || undefined,
            userId: session.user.id,
            entityType: "PropertyTransaction",
            entityId: input.transactionId,
            metadata: { from: "active", to: "completed", trigger: "milestone_auto_completion" },
          });

          revalidateTx(input.transactionId);
        }
      }
    } catch (err) {
      // Defensive — never let an auto-flip failure throw out of the confirm
      // action. The milestone confirm itself already succeeded; status
      // flipping is a knock-on convenience.
      console.error("[confirmMilestoneAction] auto status flip failed:", err);
    }
  }

  // Push to subscribed portal contacts (fire-and-forget)
  if (def) {
    const code  = def.code;
    const label = getMilestoneCopy(code).label;
    const short = tx.propertyAddress.split(",")[0];

    // Unified exchange / completion / ready-to-exchange strings — same copy
    // fires regardless of which code path (agent confirm, claim wizard, or
    // client self-confirm). See PUSH_NOTIF_STRINGS doc for the approved set.
    let title = "One step closer";
    let body  = `${label}, done at ${short}.`;

    if (code === "VM19" || code === "PM26") {
      title = "Contracts exchanged!";
      body  = `${short}. The sale is now legally binding. Congratulations.`;
    } else if (code === "VM20" || code === "PM27") {
      title = "It's completed!";
      body  = `${short} is yours. Congratulations on your move.`;
    } else if (code === "VM18" || code === "PM25") {
      title = "Ready to exchange";
      body  = `Everything's in place at ${short}. Exchange is next.`;
    } else if (input.eventDate) {
      const fmtDate = new Date(input.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      title = `Date confirmed: ${short}`;
      body  = `${label} booked for ${fmtDate}`;
    }

    pushToTransaction(input.transactionId, {
      title,
      body,
      urlPath: "/progress",
    }).catch(() => {});

    // Email all vendor/purchaser portal contacts with a translated progress update.
    //
    // ── Skeleton-mode wiring (added 2026-05-27) ───────────────────────
    // Derive the confirmer's route (agent / sales_progressor) from
    // session.user.role and compute the bilateral handoff direction from
    // whether the paired milestone is already complete. Both pass through
    // to the assembler so route-varied and direction-gated Section
    // entries match correctly. Strictly no-op when the flag is off (the
    // assembler doesn't construct a FileShape at all in that case).
    const confirmerRoute_self = roleToConfirmerRoute(session.user.role);
    const counterpartComplete_self = await isBilateralCounterpartComplete(input.transactionId, code).catch(() => false);
    const handoffDirection_self = computeHandoffDirection(code, counterpartComplete_self);

    // Per-transaction debug toggle (suppressPortalConfirmEmails): when set
    // by internal staff, the portal confirm email is skipped. All other
    // side effects of a confirm (chain notifications, celebrations, SP
    // bell, reminder engine knock-on) still fire.
    if (!tx.suppressPortalConfirmEmails) {
      sendAdminMilestoneNotificationToPortal(
        input.transactionId,
        code,
        input.eventDate ?? null,
        session.user.id,
        confirmerRoute_self,
        handoffDirection_self,
      ).catch(() => {});

      // Auto-counterpart fan-out for the four exchange/completion codes
      // (VM19↔PM26, VM20↔PM27). The DB row for the counterpart was already
      // completed inside the prisma.$transaction above; this fires its
      // customer-facing email so the non-confirming side is notified.
      // Internal-to-internal call (NOT through sendAdminMilestoneNotificationToPortal)
      // to keep queue-bypass + staleness + suppression rules in one place.
      // Non-counterpart codes are a no-op inside the helper.
      fireAutoCounterpartEmails(
        input.transactionId,
        code,
        session.user.id,
        confirmerRoute_self,
      ).catch(() => {});

      // Completion-pack scheduling for exchange confirmations only.
      // Fires now (E2/E3), schedules for completionDate - 3 days (E1),
      // or skips if completion is in the past.
      if (code === "VM19" || code === "PM26") {
        scheduleOrSendCompletionPack(input.transactionId, code).catch(() => {});
      }
    }

    // Retention email: fire first-exchange celebration for the agent who owns the file
    if (code === "VM19" || code === "PM26") {
      maybeFireFirstExchangeEmail(session.user.id, input.transactionId).catch(() => {});
    }

    // SP bell notification: when an agency-side user (director/negotiator/viewer)
    // confirms a milestone on an outsourced file, ping the assigned Sales Progressor.
    // Skip when the confirmer IS the SP, or when there's no SP assigned.
    const isAgencyRole =
      session.user.role === "director" ||
      session.user.role === "negotiator" ||
      session.user.role === "viewer";
    if (
      tx.serviceType === "outsourced" &&
      tx.assignedUserId &&
      tx.assignedUserId !== session.user.id &&
      isAgencyRole
    ) {
      notifyOutsourcedMilestoneConfirmed({
        spUserId: tx.assignedUserId,
        transactionId: input.transactionId,
        confirmerName: session.user.name ?? "An agent",
        milestoneLabel: label,
        milestoneCode: code,
      }).catch(() => {});
    }
  }

  // Build intent-based notification status (check email addresses without blocking on send).
  // Wrapped in try/catch so any Prisma issue here can't bring the whole
  // action down with a 500 — the milestone has already saved by the time
  // we reach this block, and the notifications array is purely advisory
  // (the actual sends are fire-and-forget elsewhere). Sentry still captures
  // the error for later triage.
  const notifications: NotificationStatus[] = [];
  if (def) {
    try {
      const emailCopy = getMilestoneCopy(def.code).emailCopy ?? {};
      const notifTx = await prisma.propertyTransaction.findUnique({
        where: { id: input.transactionId },
        select: {
          serviceType:  true,
          assignedUser: { select: { id: true, name: true, email: true } },
          agentUser:    { select: { id: true, name: true, email: true } },
          contacts: {
            where: { roleType: { in: ["vendor", "purchaser"] } },
            select: { id: true, name: true, email: true, roleType: true },
          },
        },
      });
      if (notifTx) {
        for (const c of notifTx.contacts) {
          const role = c.roleType as "vendor" | "purchaser";
          if (!emailCopy[role]) continue;
          notifications.push({
            role: role === "vendor" ? "seller" : "buyer",
            contactId: c.id,
            contactDisplayName: getDisplayName({ name: c.name }),
            status: c.email ? "queued" : "skipped_no_email",
          });
        }
        // BUG2 mirror: skip agent notification display when agent is the confirmer (self-managed)
        const skipAgentNotif = notifTx.serviceType === "self_managed"
          && session.user.id === notifTx.agentUser?.id;
        if (emailCopy.vendorAgent && !skipAgentNotif) {
          if (notifTx.agentUser) {
            notifications.push({
              role: "agent",
              contactId: null,
              contactDisplayName: getDisplayName({ name: notifTx.agentUser.name }),
              status: notifTx.agentUser.email ? "queued" : "skipped_no_email",
            });
          } else {
            notifications.push({ role: "agent", contactId: null, contactDisplayName: "Agent", status: "skipped_no_contact" });
          }
        }
        // BUG2 mirror: skip progressor notification display when SP is the confirmer (outsourced)
        const skipProgressorNotif = notifTx.serviceType === "outsourced"
          && session.user.id === notifTx.assignedUser?.id;
        if (emailCopy.progressor && !skipProgressorNotif) {
          if (notifTx.assignedUser) {
            notifications.push({
              role: "progressor",
              contactId: null,
              contactDisplayName: getDisplayName({ name: notifTx.assignedUser.name }),
              status: notifTx.assignedUser.email ? "queued" : "skipped_no_email",
            });
          }
        }
      }
    } catch (err) {
      console.error("[confirmMilestoneAction] notifications-status build failed:", err);
    }
  }

  const isExchangeCode = def?.code === "VM19" || def?.code === "PM26";
  return {
    ok: true as const,
    triggeredCelebration: isExchangeCode,
    propertyAddress: isExchangeCode ? tx.propertyAddress : undefined,
    notifications,
  };
}

export async function markNotRequiredAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason: string;
  purchaseType?: PurchaseType;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const result = await markNotRequiredWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    purchaseType: input.purchaseType,
  });

  revalidateTx(input.transactionId);

  return result;
}

export async function reverseMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason?: string;
  downstreamIds?: string[];
  newPurchaseType?: PurchaseType;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await reverseMilestoneWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    downstreamIds: input.downstreamIds,
    newPurchaseType: input.newPurchaseType,
  });

  // Re-evaluate reminders so freshly-reinstated milestones (and any
  // cascaded reinstatements) get their chase rules re-seeded immediately.
  // Without this, the user has to wait for the next cron tick — but the
  // click on "Reinstate" is an explicit request for the chase to resume.
  await evaluateTransactionReminders(input.transactionId).catch((err) => {
    console.error(`[reverseMilestoneAction] evaluate failed:`, err);
  });

  void trackServerEvent(session.user.id, ANALYTICS_EVENTS.MILESTONE_UNCONFIRMED, {
    transactionId: input.transactionId,
    milestoneId:   input.milestoneDefinitionId,
    agencyId:      session.user.agencyId || undefined,
  });

  revalidateTx(input.transactionId);
}

// ─── Undo milestone (two-step: impact read + atomic write) ───────────────────

export async function getUndoImpactAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return getUndoImpact(input.transactionId, input.milestoneDefinitionId);
}

export async function executeUndoMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  mode: "target_only" | "cascade";
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await executeUndoMilestone({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    mode: input.mode,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
  });

  // 2026-07-13 fix (Chunk 2b): sync re-eval after an undo. executeUndoMilestone
  // cancels any active logs whose target/anchor is one of the reversed
  // milestones, but it does NOT create new logs for rules whose target is
  // now uncompleted again (e.g., undoing an NR flips the target back to
  // "available", which the engine reads as "not done yet" and would spin
  // up a fresh chase for on the next 04:00 pass). We spin them up now so
  // the timeline stays coherent with the user's action.
  await evaluateTransactionReminders(input.transactionId).catch((err) => {
    console.error("[executeUndoMilestoneAction] reminder re-eval failed", err);
  });

  revalidateTx(input.transactionId);
}

// ─── Exchange / Completion reconciliation ────────────────────────────────────

const BILATERAL_PAIRS: Record<string, string> = {
  VM19: "PM26", PM26: "VM19",
  VM20: "PM27", PM27: "VM20",
};

export async function getExchangeReconciliationList(input: {
  transactionId: string;
  milestoneDefinitionId: string;
}): Promise<{
  outstanding: { id: string; name: string; side: string; code: string; eventDateRequired: boolean }[];
  counterDefId: string | null;
  skipModal: boolean;
}> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  const counterCode = BILATERAL_PAIRS[def.code];
  let counterDefId: string | null = null;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id ?? null;
  }

  let excludeIds = [input.milestoneDefinitionId, counterDefId].filter(Boolean) as string[];

  // Exchange flow: completion milestones (VM20/PM27) can't have occurred yet —
  // they require exchange as a prerequisite. Exclude them so they don't appear
  // in the reconciliation list when confirming VM19 or PM26.
  if (def.code === "VM19" || def.code === "PM26") {
    const completionDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM20", "PM27"] } },
      select: { id: true },
    });
    excludeIds = [...excludeIds, ...completionDefs.map((d) => d.id)];
  }

  const allDefs = await prisma.milestoneDefinition.findMany({
    where: { id: { notIn: excludeIds } },
    select: { id: true, name: true, side: true, code: true, eventDateRequired: true, orderIndex: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  // Round-scoped: the reconciliation list filters out already-done
  // milestones so a relisted file's archived PMs aren't presented as
  // already-done on the new round.
  const txRowForReconScope = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const reconScope = forRound(txRowForReconScope?.activeBuyerRoundId ?? null, input.transactionId);
  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: input.transactionId,
      state: { in: ["complete", "not_required"] },
      ...milestoneScopeWhere(reconScope),
    },
    select: { milestoneDefinitionId: true },
  });
  const doneIds = new Set(completions.map((c) => c.milestoneDefinitionId));

  const outstanding = allDefs
    .filter((d) => !doneIds.has(d.id))
    .map(({ id, name, side, code, eventDateRequired }) => ({ id, name, side, code, eventDateRequired }));

  return { outstanding, counterDefId, skipModal: outstanding.length === 0 };
}

export async function confirmExchangeReconciliationAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
  outstandingIds: string[];
  outstandingDates: Record<string, string>;
  completionDate?: string;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  const counterCode = BILATERAL_PAIRS[def.code];
  let counterDefId: string | undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id;
  }

  const outstandingDefs = input.outstandingIds.length > 0
    ? await prisma.milestoneDefinition.findMany({
        where: { id: { in: input.outstandingIds } },
        select: { id: true, code: true },
      })
    : [];

  const now = new Date();

  await prisma.$transaction(async (ptx) => {
    // 1. Sweep outstanding milestones FIRST so prerequisite chains are satisfied
    //    before completeMilestone runs its prereq guard for the counterpart
    //    (e.g. PM25 must be complete before completeMilestone(PM26) checks it).
    if (input.outstandingIds.length > 0) {
      // Compound upsert key dropped in Phase 1 commit 1; preserves the
      // create-if-missing branch inside the existing $transaction ptx.
      // Phase 1 commit 4e: round-scope the find + def-side-aware stamp
      // on the create branch.
      const txRowSweep = await ptx.propertyTransaction.findUnique({
        where: { id: input.transactionId },
        select: { activeBuyerRoundId: true },
      });
      const activeBuyerRoundIdSweep = txRowSweep?.activeBuyerRoundId ?? null;
      const sweepScope = forRound(activeBuyerRoundIdSweep, input.transactionId);
      const sweepDefs = await ptx.milestoneDefinition.findMany({
        where: { id: { in: input.outstandingIds } },
        select: { id: true, side: true },
      });
      const sweepSideById = new Map(sweepDefs.map((d) => [d.id, d.side]));
      await Promise.all(
        input.outstandingIds.map(async (defId, i) => {
          const dateStr = input.outstandingDates[defId];
          const existing = await ptx.milestoneCompletion.findFirst({
            where: {
              transactionId: input.transactionId,
              milestoneDefinitionId: defId,
              ...milestoneScopeWhere(sweepScope),
            },
            select: { id: true },
          });
          if (existing) {
            return ptx.milestoneCompletion.update({
              where: { id: existing.id },
              data: {
                state: "complete",
                completedAt: new Date(now.getTime() + i),
                eventDate: dateStr ? new Date(dateStr) : null,
                completedById: session.user.id,
                notRequiredReason: null,
                reconciledAtExchange: true,
              },
            });
          }
          return ptx.milestoneCompletion.create({
            data: {
              transactionId: input.transactionId,
              milestoneDefinitionId: defId,
              state: "complete",
              completedAt: new Date(now.getTime() + i),
              eventDate: dateStr ? new Date(dateStr) : null,
              completedById: session.user.id,
              reconciledAtExchange: true,
              buyerRoundId: sweepSideById.get(defId) === "purchaser" ? activeBuyerRoundIdSweep : null,
            },
          });
        })
      );

      // Cancel pending chase tasks + complete reminder logs for swept milestones
      const sweptCodes = outstandingDefs.map((d) => d.code);
      const logs = await ptx.reminderLog.findMany({
        where: {
          transactionId: input.transactionId,
          status: "active",
          reminderRule: { targetMilestoneCode: { in: sweptCodes } },
        },
        select: { id: true },
      });

      if (logs.length > 0) {
        const logIds = logs.map((l) => l.id);
        await ptx.chaseTask.updateMany({
          where: { reminderLogId: { in: logIds }, status: "pending" },
          data: { status: "cancelled" },
        });
        await ptx.reminderLog.updateMany({
          where: { id: { in: logIds } },
          data: { status: "completed", statusReason: "Exchange confirmed" },
        });
      }
    }

    // 2. Primary milestone
    const sweepConfirmer = { kind: "user" as const, id: session.user.id, name: session.user.name ?? "" };
    await completeMilestone({
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      confirmer: sweepConfirmer,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    }, ptx);

    // 3. Bilateral counterpart — prereqs now satisfied by the sweep above
    if (counterDefId) {
      const bilateralTxRow = await ptx.propertyTransaction.findUnique({
        where: { id: input.transactionId },
        select: { activeBuyerRoundId: true },
      });
      const bilateralScope = forRound(bilateralTxRow?.activeBuyerRoundId ?? null, input.transactionId);
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          state: "complete",
          ...milestoneScopeWhere(bilateralScope),
        },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          confirmer: sweepConfirmer,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        }, ptx);
      }
    }

    // 4. Exchange Forecast sync
    if ((def.code === "VM19" || def.code === "PM26") && input.eventDate) {
      await ptx.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { expectedExchangeDate: new Date(input.eventDate) },
      });
    }
  }, {
    // Default 5s is too tight: this block does the outstanding sweep, both
    // bilateral completeMilestone fan-outs (6-10 queries each), and the
    // expectedExchangeDate update. The staging deploy hit P2028 at 5333ms
    // (Vercel log digest 1190048595, 2026-06-07). 30s clears the bilateral
    // exchange pair without changing semantics.
    timeout: 30000,
    maxWait: 10000,
  });

  // 2026-07-13 fix (Chunk 2a): sync re-eval so any reminder rules that
  // were dormant waiting on the reconciled milestones' eventDate wake up
  // immediately. Reconciliation sets eventDates on VM19/PM26 (or their
  // bilateral counterparts) and any earlier milestones the sweep closed;
  // without this call a follow-up chase anchored on those events would
  // sit idle until the next 04:00 cron.
  await evaluateTransactionReminders(input.transactionId).catch((err) => {
    console.error("[confirmExchangeReconciliationAction] reminder re-eval failed", err);
  });

  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");

  // Completion date sync for VM20/PM27 (confirmed at completion).
  // Wrapped — the milestone is already saved by this point; the date
  // sync is a polish step and must not bring the whole action down.
  if ((def.code === "VM20" || def.code === "PM27") && input.eventDate) {
    try {
      const actualDate = new Date(input.eventDate);
      const txData = await prisma.propertyTransaction.findFirst({
        where: { id: input.transactionId },
        select: { completionDate: true },
      });
      const existingDate = txData?.completionDate;
      const dateMismatch = !existingDate ||
        Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000;
      if (dateMismatch) {
        await prisma.propertyTransaction.update({
          where: { id: input.transactionId },
          data: { completionDate: actualDate },
        });
        revalidateTx(input.transactionId);
      }
    } catch (err) {
      console.error("[confirmExchangeReconciliationAction] completionDate sync failed:", err);
    }
  }

  // Expected completion date captured at exchange time (VM19/PM26).
  // Same protection — the exchange already wrote, the predicted-completion
  // update is a downstream polish step.
  if ((def.code === "VM19" || def.code === "PM26") && input.completionDate) {
    try {
      await prisma.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { completionDate: new Date(input.completionDate) },
      });
      revalidateTx(input.transactionId);
    } catch (err) {
      console.error("[confirmExchangeReconciliationAction] expected completionDate update failed:", err);
    }
  }

  // Push notifications (fire-and-forget)
  const code  = def.code;
  const label = getMilestoneCopy(code).label;
  const short = tx.propertyAddress.split(",")[0];

  // Unified exchange / completion strings — matches Site 8 + the portal
  // confirm path; see PUSH_NOTIF_STRINGS for the approved set.
  let title = "One step closer";
  let body  = `${label}, done at ${short}.`;

  if (code === "VM19" || code === "PM26") {
    title = "Contracts exchanged!";
    body  = `${short}. The sale is now legally binding. Congratulations.`;
  } else if (code === "VM20" || code === "PM27") {
    title = "It's completed!";
    body  = `${short} is yours. Congratulations on your move.`;
  }

  pushToTransaction(input.transactionId, { title, body, urlPath: "/progress" }).catch(() => {});

  // Skeleton-mode wiring (added 2026-05-27) — see equivalent comment block
  // at the top callsite of sendAdminMilestoneNotificationToPortal above.
  // isBilateralCounterpartComplete is awaited so we cannot let it throw —
  // a Prisma blip here would 500 the whole action. Defaults to false on
  // error, which means the email assembler uses the pre-handoff Section
  // set (safer than the post-handoff one if state is unclear).
  const confirmerRoute_re = roleToConfirmerRoute(session.user.role);
  const counterpartComplete_re = await isBilateralCounterpartComplete(input.transactionId, code).catch(() => false);
  const handoffDirection_re = computeHandoffDirection(code, counterpartComplete_re);

  sendAdminMilestoneNotificationToPortal(
    input.transactionId,
    code,
    input.eventDate ?? null,
    session.user.id,
    confirmerRoute_re,
    handoffDirection_re,
  ).catch(() => {});

  // Auto-counterpart fan-out + completion-pack scheduling on the
  // reconciliation path too — same rules as the standard confirm path.
  fireAutoCounterpartEmails(
    input.transactionId,
    code,
    session.user.id,
    confirmerRoute_re,
  ).catch(() => {});
  if (code === "VM19" || code === "PM26") {
    scheduleOrSendCompletionPack(input.transactionId, code).catch(() => {});
  }

  const isExchangeCode = def.code === "VM19" || def.code === "PM26";
  return {
    triggeredCelebration: isExchangeCode,
    propertyAddress: isExchangeCode ? tx.propertyAddress : undefined,
  };
}

// ── Reconciliation-on-claim ───────────────────────────────────────────────────
// Called immediately after /api/claim succeeds when the agent selected
// "Already in progress" on the claim form. Marks the ticked milestones complete
// with the agent-supplied real-world eventDate (may be null) and the
// reconciledAtClaim=true flag so analytics, predictions, and reminders treat
// these as backdated catch-up rather than real-time activity.
//
// Per Stage 1 design (memory/project_reconciliation_arc.md):
//   - completedAt = now (when the agent ticked)
//   - eventDate   = agent-supplied real-world date, or null if unknown
//   - reconciledAtClaim = true
//   - state = "complete"
//   - completedById = claiming agent
//   - unlockDirectDependents() called for each (so downstream milestones unlock)
//
// Failure semantics: if any single completion errors, throw. /api/claim catches
// and treats the whole reconciliation as best-effort — agent lands on file with
// whatever was successfully applied (or none if early failure). Not fatal to the
// claim itself.
export async function reconcileClaimMilestonesAction(input: {
  transactionId: string;
  completions: Array<{ milestoneDefinitionId: string; eventDate?: string | null }>;
}): Promise<{ applied: number }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Ownership check: the caller must have access to this transaction.
  // Since this is called immediately after claim, the user just became the agent on it.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.completions.length === 0) return { applied: 0 };

  // Look up the milestone codes so we can call unlockDirectDependents per milestone.
  // Also load side so the create-branch buyerRoundId stamp is def-side-aware.
  const defIds = input.completions.map((c) => c.milestoneDefinitionId);
  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: defIds } },
    select: { id: true, code: true, side: true },
  });
  const codeById = new Map(defs.map((d) => [d.id, d.code]));
  const sideById = new Map(defs.map((d) => [d.id, d.side]));

  const txRowForReconClaim = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const reconClaimRoundId = txRowForReconClaim?.activeBuyerRoundId ?? null;
  const reconClaimScope = forRound(reconClaimRoundId, input.transactionId);

  const now = new Date();
  let applied = 0;

  // Apply each completion individually so a single failure doesn't roll back the
  // whole batch — agent gets partial reconciliation rather than none.
  for (let i = 0; i < input.completions.length; i++) {
    const c = input.completions[i]!;
    const code = codeById.get(c.milestoneDefinitionId);
    if (!code) continue; // Unknown definitionId — skip silently

    // Generic summary text — must NOT use the milestone's regular template
    // (which would say "Sarah confirmed X" for work Sarah didn't do — misleading
    // in the activity feed). Per ruling F: structure now, voice polish later.
    const eventDateObj = c.eventDate ? new Date(c.eventDate) : null;
    const summaryText = eventDateObj
      ? `Recorded on claim — happened on ${eventDateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : `Recorded on claim — actual date unknown`;

    try {
      // Wrapped in $transaction so the find→(update|create) for this
      // row is atomic; the partial unique index catches concurrent races.
      await prisma.$transaction(async (ptx) => {
        const existing = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            ...milestoneScopeWhere(reconClaimScope),
          },
          select: { id: true },
        });
        if (existing) {
          await ptx.milestoneCompletion.update({
            where: { id: existing.id },
            data: {
              state: "complete",
              completedAt: new Date(now.getTime() + i),
              eventDate: eventDateObj,
              completedById: session.user.id,
              notRequiredReason: null,
              reconciledAtClaim: true,
              summaryText,
            },
          });
          return;
        }
        await ptx.milestoneCompletion.create({
          data: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            state: "complete",
            completedAt: new Date(now.getTime() + i), // Tiny offset to preserve ordering
            eventDate: eventDateObj,
            completedById: session.user.id,
            reconciledAtClaim: true,
            summaryText,
            buyerRoundId: sideById.get(c.milestoneDefinitionId) === "purchaser" ? reconClaimRoundId : null,
          },
        });
      });

      // Unlock direct dependents so the downstream milestones become available.
      // Stage 1 design rule — exchange reconciliation has a known bug here; we
      // explicitly avoid repeating it.
      await unlockDirectDependents(input.transactionId, code).catch((err) =>
        console.error(`[reconcileClaimMilestonesAction] unlock failed for ${code}:`, err),
      );

      applied++;
    } catch (err) {
      console.error(
        `[reconcileClaimMilestonesAction] failed to apply ${code} on tx ${input.transactionId}:`,
        err,
      );
      // Continue with the rest — partial reconciliation is better than none
    }
  }

  // 2026-07-13 fix (Chunk 2a): sync re-eval so any reminder rules that
  // were dormant waiting on a reconciled milestone's eventDate wake up
  // immediately. reconcile-on-claim writes eventDate on every applied code
  // - without this call any follow-up chases anchored on those events
  // would only start after the next 04:00 cron.
  await evaluateTransactionReminders(input.transactionId).catch((err) => {
    console.error("[reconcileClaimMilestonesAction] reminder re-eval failed", err);
  });

  revalidateTx(input.transactionId);
  return { applied };
}

// ─── Admin migration: backdated bulk tick ──────────────────────────────────
// Admin-only. Marks a batch of milestones complete with HISTORICAL dates from
// the old system. Designed to leave the file INDISTINGUISHABLE from a natively-
// created one in the UI:
//   - completedById attributed to the chosen agent (not admin); null when no
//     agent is picked (renders as "Auto-confirmed" like portal confirmations)
//   - summaryText left null so the timeline renders the milestone's normal
//     name without any "[Migrated]" marker
//   - NO OutboundMessage rows written — MilestoneCompletion already surfaces
//     in the Updates feed via getActivityTimeline (lib/services/comms.ts:47),
//     so writing internal_notes would duplicate every entry
//   - lastActivityAt set to the latest backdated event so the file doesn't
//     read as "Just added" on activity-driven widgets
//   - one evaluateTransactionReminders pass at the end to recompute reminders
//
// Caller (the migration page) is expected to call createTransactionAction first
// with migrationCreatedAt + migrationAgentUserId set, then call this with the
// same agentUserId for the historical milestone ticks.
export async function migrateCompleteMilestonesAction(input: {
  transactionId: string;
  completions: Array<{ milestoneDefinitionId: string; eventDate: string }>;
  agentUserId?: string;
}): Promise<{ applied: number }> {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    throw new Error("Forbidden: migration action requires admin role");
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  if (input.completions.length === 0) return { applied: 0 };

  const defIds = input.completions.map((c) => c.milestoneDefinitionId);
  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: defIds } },
    select: { id: true, code: true, name: true, side: true, eventDateRequired: true },
  });
  const defById = new Map(defs.map((d) => [d.id, d]));

  // Attribute completions to the chosen agent. Null when not supplied — better
  // than the admin's id (which renders as "Admin confirmed X" in the timeline).
  const completerId = input.agentUserId ?? null;

  // Phase 1 commit 4e — round scope for migrate-action find-after-write +
  // create-branch stamping. activeBuyerRoundId fetched once per call.
  const txRowForMigrate = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const migrateRoundId = txRowForMigrate?.activeBuyerRoundId ?? null;
  const migrateScope = forRound(migrateRoundId, input.transactionId);

  let applied = 0;
  let latestEventTime = 0;

  for (let i = 0; i < input.completions.length; i++) {
    const c = input.completions[i]!;
    const def = defById.get(c.milestoneDefinitionId);
    if (!def) continue;

    const eventDateObj = new Date(c.eventDate);
    if (Number.isNaN(eventDateObj.getTime())) continue;
    if (eventDateObj.getTime() > latestEventTime) latestEventTime = eventDateObj.getTime();

    // eventDate is a semantic real-world-event field per
    // docs/reference/PRODUCT_TRUTH.md — it should only be populated for
    // milestones whose definition carries eventDateRequired: true (survey,
    // valuation, mortgage offer, exchange, completion target). For other
    // milestones the user-supplied date is the historical completedAt only,
    // not an event date — so we leave eventDate null.
    const eventDateForCompletion = def.eventDateRequired ? eventDateObj : null;

    try {
      await prisma.$transaction(async (ptx) => {
        const existing = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            ...milestoneScopeWhere(migrateScope),
          },
          select: { id: true },
        });
        if (existing) {
          await ptx.milestoneCompletion.update({
            where: { id: existing.id },
            data: {
              state: "complete",
              completedAt: eventDateObj,
              eventDate: eventDateForCompletion,
              completedById: completerId,
              notRequiredReason: null,
              summaryText: null,
            },
          });
          return;
        }
        await ptx.milestoneCompletion.create({
          data: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            state: "complete",
            completedAt: eventDateObj,
            eventDate: eventDateForCompletion,
            completedById: completerId,
            summaryText: null,
            buyerRoundId: def.side === "purchaser" ? migrateRoundId : null,
          },
        });
      });

      await unlockDirectDependents(input.transactionId, def.code).catch((err) =>
        console.error(`[migrateCompleteMilestonesAction] unlock failed for ${def.code}:`, err),
      );

      // Flip any chase reminders targeting this milestone to status="completed".
      // The trailing evaluateTransactionReminders pass can race (or no-op if the
      // file is already on hold), and even when it runs it uses deactivateLog
      // which lands as "inactive" — the wrong terminal state for "we have proof
      // this milestone happened". Mirrors completeMilestoneAction's flow.
      await autoCompleteRemindersForMilestone(input.transactionId, def.code).catch((err) =>
        console.error(`[migrateCompleteMilestonesAction] reminder auto-complete failed for ${def.code}:`, err),
      );

      applied++;
    } catch (err) {
      console.error(
        `[migrateCompleteMilestonesAction] failed to apply ${def.code} on tx ${input.transactionId}:`,
        err,
      );
    }
  }

  // Bump lastActivityAt to the most recent backdated event so the file reads
  // as "Active <X> ago" rather than "Just added" on the activity-driven UIs.
  if (latestEventTime > 0) {
    await prisma.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { lastActivityAt: new Date(latestEventTime) },
    }).catch((err) =>
      console.error(`[migrateCompleteMilestonesAction] lastActivityAt bump failed:`, err),
    );
  }

  // Exchange gate evaluation — unlockDirectDependents only handles
  // predecessor-chain unlocks, but VM18 / PM25 are gates that depend on ALL
  // side-blockers being complete. After bulk-ticking, run the gate check
  // for both sides so any side that's now fully ready gets its gate flipped
  // from "locked" to "available".
  await maybeUnlockExchangeGate(input.transactionId, "vendor", completerId).catch((err) =>
    console.error(`[migrateCompleteMilestonesAction] vendor gate unlock failed:`, err),
  );
  await maybeUnlockExchangeGate(input.transactionId, "purchaser", completerId).catch((err) =>
    console.error(`[migrateCompleteMilestonesAction] purchaser gate unlock failed:`, err),
  );

  // One reminder-engine pass against the new completion state — seeds the
  // reminders the file should have right now, no duplicates for completed ones.
  await evaluateTransactionReminders(input.transactionId).catch((err) =>
    console.error(`[migrateCompleteMilestonesAction] reminder evaluate failed:`, err),
  );

  revalidateTx(input.transactionId);
  return { applied };
}

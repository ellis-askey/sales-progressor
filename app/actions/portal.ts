"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { portalCompleteMilestone, portalMarkNotRequired, PORTAL_AGENT_ONLY_ERROR } from "@/lib/services/portal";
import { sendClientPortalMessage, sendProgressorPortalReply } from "@/lib/services/portal-messages";
import { prisma } from "@/lib/prisma";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { notifyPortalExpectedDateSet, notifyPortalChaseNote } from "@/lib/services/notifications";
import { setUkChaseTime } from "@/lib/services/reminders";
import { toUKDateStr } from "@/lib/utils";

// Discriminated result so the portal UI can render the B1 hard-block
// gracefully instead of treating it as a server error.
export type PortalConfirmResult =
  | { ok: true }
  | { ok: false; reason: "agent_only" };

export async function portalConfirmMilestoneAction(input: {
  token: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}): Promise<PortalConfirmResult> {
  try {
    await portalCompleteMilestone(input);
  } catch (err) {
    // B1 hard-block: surface the agent-only refusal as a structured result
    // so the bottom-sheet renders the explanatory copy instead of a generic
    // 500. Any other error rethrows (the UI still falls back to its generic
    // error path for genuine failures — invalid token, prereq guard, etc.).
    if (err instanceof Error && err.message === PORTAL_AGENT_ONLY_ERROR) {
      return { ok: false, reason: "agent_only" };
    }
    throw err;
  }

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");

  return { ok: true };
}

export async function portalMarkNotRequiredAction(input: {
  token: string;
  milestoneDefinitionId: string;
}) {
  await portalMarkNotRequired(input);

  revalidatePath(`/portal/${input.token}`, "page");
  revalidatePath(`/portal/${input.token}/progress`, "page");
  revalidatePath(`/portal/${input.token}/updates`, "page");
}

export async function portalSendMessageAction(input: {
  token: string;
  content: string;
}) {
  if (!input.content.trim()) throw new Error("Message cannot be empty");
  await sendClientPortalMessage(input.token, input.content.trim());
  revalidatePath(`/portal/${input.token}/updates`, "page");
}

export async function replyPortalMessageAction(input: {
  transactionId: string;
  contactId: string;
  content: string;
}) {
  const session = await requireSession();
  if (!input.content.trim()) throw new Error("Reply cannot be empty");
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await sendProgressorPortalReply(
    input.transactionId,
    input.contactId,
    input.content.trim(),
    session.user.id,
    session.user.name ?? "Your team"
  );

  revalidatePath(`/transactions/${input.transactionId}`, "page");
}

// ─── B5 of the client-chase arc — respond-page actions ──────────────────────
//
// Three actions a client can take on /portal/{token}/respond. Each one
// resolves the contact via the existing token lookup, validates the
// milestone belongs to the contact's side (mirror of the portalCompleteMilestone
// guard), then writes the appropriate state. ENGAGEMENT TRACKING is the
// common thread: every action bumps ClientChaseState.lastEngagedAt so the
// 14-day silence window restarts.
//
// COPY STATUS: any user-facing strings in here are DRAFT pending the
// pre-B7 copy batch. The action signatures + state writes are final.

// 1. Confirm — full A1 unified cascade (via existing portalConfirmMilestoneAction),
//    then mark ClientChaseState row as "completed" so B7's cron stops chasing.
//    Inherits the B1 hard-block protection on the six bilateral codes.
export async function portalConfirmFromRespondAction(input: {
  token: string;
  milestoneCode: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const result = await portalConfirmMilestoneAction({
    token: input.token,
    milestoneDefinitionId: input.milestoneDefinitionId,
    eventDate: input.eventDate,
  });

  if (result.ok) {
    const contact = await prisma.contact.findUnique({
      where: { portalToken: input.token },
      select: { id: true, propertyTransactionId: true },
    });
    if (contact) {
      await prisma.clientChaseState.updateMany({
        where: {
          transactionId: contact.propertyTransactionId,
          contactId: contact.id,
          milestoneCode: input.milestoneCode,
          status: "active",
        },
        data: { status: "completed" },
      });
    }
  }

  revalidatePath(`/portal/${input.token}/respond`, "page");
  return result;
}

// 2. Set expected date — writes MilestoneCompletion.expectedDate (B2) but
//    leaves state="available" (the milestone is NOT marked complete). The
//    client's "I think it'll happen on X" is recorded as speculation; the
//    chase continues, but the silence window resets.
export async function portalSetExpectedDateAction(input: {
  token: string;
  milestoneCode: string;
  milestoneDefinitionId: string;
  expectedDate: string;
}) {
  if (!input.expectedDate) throw new Error("Date required");

  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, name: true, propertyTransactionId: true, roleType: true },
  });
  if (!contact) throw new Error("Invalid token");

  // Side-match guard (mirrors portalCompleteMilestone)
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const def = await prisma.milestoneDefinition.findFirst({
    where: { id: input.milestoneDefinitionId, side },
    select: { id: true },
  });
  if (!def) throw new Error("Milestone not found");

  // upsert so the row exists even on the first contact-initiated date.
  // Compound upsert key dropped in Phase 1 commit 1; wrap find→
  // (update|create) in $transaction so the partial unique index catches
  // any concurrent-create race.
  await prisma.$transaction(async (ptx) => {
    const existing = await ptx.milestoneCompletion.findFirst({
      where: { transactionId: contact.propertyTransactionId, milestoneDefinitionId: def.id },
      select: { id: true },
    });
    if (existing) {
      await ptx.milestoneCompletion.update({
        where: { id: existing.id },
        data: { expectedDate: new Date(input.expectedDate) },
      });
      return;
    }
    await ptx.milestoneCompletion.create({
      data: {
        transactionId: contact.propertyTransactionId,
        milestoneDefinitionId: def.id,
        state: "available",
        expectedDate: new Date(input.expectedDate),
      },
    });
  });

  // Engagement tracking — silence clock resets
  await prisma.clientChaseState.updateMany({
    where: {
      transactionId: contact.propertyTransactionId,
      contactId: contact.id,
      milestoneCode: input.milestoneCode,
      status: "active",
    },
    data: { lastEngagedAt: new Date() },
  });

  // Snooze the agent reminder until the morning of the date the client gave
  // us. The auto-chase cron's snooze-suppression filter
  // (lib/services/client-chase-cron.ts ~line 255) honours
  // ReminderLog.snoozedUntil, so this single write pauses BOTH the agent's
  // work-queue row AND the automated client chase email until that day.
  //
  // Guard: if the client typed today or a past date they're effectively
  // saying "this should already be done", so we leave the chase running —
  // they need the next-cycle nudge to actually confirm it.
  //
  // We resolve the reminder via ReminderRule.targetMilestoneCode so the
  // snooze attaches to the right rule even if a milestone has multiple
  // reminders (defensive — no production rules do today, but the schema
  // permits it).
  const todayUKStr = toUKDateStr(new Date());
  const expectedUKStr = toUKDateStr(new Date(input.expectedDate));
  if (expectedUKStr > todayUKStr) {
    const snoozeUntil = setUkChaseTime(new Date(input.expectedDate));
    await prisma.reminderLog.updateMany({
      where: {
        transactionId: contact.propertyTransactionId,
        status: "active",
        reminderRule: { targetMilestoneCode: input.milestoneCode },
      },
      data: { snoozedUntil: snoozeUntil },
    });
  }

  // Agent/SP-visibility cascade (Phase 1.2 of the portal-action-notifications
  // arc). Without these writes, a client picking a date is silent to the
  // file owner — they never learn the client provided an estimate. We add:
  //   - an OutboundMessage internal_note so the activity feed shows it
  //   - a Notification row so the bell rings
  // Fire-and-forget (.catch swallow) so a notification failure doesn't
  // break the primary write.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { agentUserId: true, assignedUserId: true },
  });
  const targetUserId = tx?.assignedUserId ?? tx?.agentUserId;
  if (targetUserId) {
    const milestoneLabel = getMilestoneCopy(input.milestoneCode).label;
    const dateFormatted = new Date(input.expectedDate).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    // Include "via the client portal" so the AgentBell content-filter counts
    // this as a portal-originated event (same signal the milestone-confirm
    // path uses — see lib/services/portal.ts:467).
    const content = `${contact.name} told us via the client portal they're expecting "${milestoneLabel}" around ${dateFormatted}`;

    prisma.outboundMessage.create({
      data: {
        transactionId: contact.propertyTransactionId,
        type: "internal_note",
        contactIds: [contact.id],
        content,
        createdById: targetUserId,
      },
    }).catch(() => {});

    notifyPortalExpectedDateSet({
      userId: targetUserId,
      transactionId: contact.propertyTransactionId,
      contactName: contact.name,
      contactRole: contact.roleType,
      milestoneLabel,
      milestoneCode: input.milestoneCode,
      expectedDate: new Date(input.expectedDate),
    }).catch(() => {});
  }

  revalidatePath(`/portal/${input.token}/respond`, "page");
}

// 3. Leave a note — creates a PortalMessage tied to the agent, prefixed with
//    the milestone context so the agent timeline shows what the note is
//    about. Engagement tracking same as above.
export async function portalLeaveChaseNoteAction(input: {
  token: string;
  milestoneCode: string;
  note: string;
}) {
  const trimmed = input.note.trim();
  if (!trimmed) throw new Error("Note cannot be empty");

  const contact = await prisma.contact.findUnique({
    where: { portalToken: input.token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact) throw new Error("Invalid token");

  const label = getMilestoneCopy(input.milestoneCode).label;
  await sendClientPortalMessage(input.token, `[About: ${label}] ${trimmed}`);

  await prisma.clientChaseState.updateMany({
    where: {
      transactionId: contact.propertyTransactionId,
      contactId: contact.id,
      milestoneCode: input.milestoneCode,
      status: "active",
    },
    data: { lastEngagedAt: new Date() },
  });

  // Agent/SP-visibility cascade (Phase 1.3). The note already lands in the
  // PortalMessage table (via sendClientPortalMessage above) and triggers a
  // web push. But the messages view is siloed from the main activity feed,
  // and there's no bell entry, so it's easy to miss. Cross-write to
  // OutboundMessage (activity feed) + Notification (bell) so the agent has
  // multiple chances to see the note. Fire-and-forget — failure here must
  // not break the note's primary save.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { agentUserId: true, assignedUserId: true },
  });
  const targetUserId = tx?.assignedUserId ?? tx?.agentUserId;
  if (targetUserId) {
    const notePreview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
    // Include "via the client portal" so the AgentBell content-filter counts
    // this as a portal-originated event.
    const content = `${contact.name} left a note via the client portal about "${label}": "${trimmed}"`;

    prisma.outboundMessage.create({
      data: {
        transactionId: contact.propertyTransactionId,
        type: "internal_note",
        contactIds: [contact.id],
        content,
        createdById: targetUserId,
      },
    }).catch(() => {});

    notifyPortalChaseNote({
      userId: targetUserId,
      transactionId: contact.propertyTransactionId,
      contactName: contact.name,
      contactRole: contact.roleType,
      milestoneLabel: label,
      milestoneCode: input.milestoneCode,
      notePreview,
    }).catch(() => {});
  }

  revalidatePath(`/portal/${input.token}/respond`, "page");
}

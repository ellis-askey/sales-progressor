import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Generic primitive. Most callers should use the typed event helpers below
 * so the `type` string and payload shape stay consistent.
 *
 * Distinct from SystemNotification (the platform-flag table used by
 * medians_ready and similar). This table is user-facing; that one isn't.
 */
export async function createNotification(args: {
  userId: string;
  type: string;
  transactionId?: string | null;
  payload: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      transactionId: args.transactionId ?? null,
      payload: args.payload,
    },
  });
}

/**
 * A client-facing "you did this" note, shown back to the client in their own
 * portal timeline. Used for self-service actions (onward changes, solicitor
 * switch) so the client sees a record of what they told us.
 *
 * Privacy: the VENDOR timeline surfaces every `visibleToClient` message on the
 * file (it ignores `contactIds`), so a purchaser's self-note would leak to the
 * vendor. We therefore only write self-notes for vendor-side actors — which
 * covers every onward action (onward is seller-only) and seller edits. A
 * purchaser scope filters by their own contactId, so a vendor self-note never
 * reaches the buyer, and nothing crosses to the other side.
 *
 * Plural-aware: when more than one client sits on the same side of the file,
 * the note names the actor ("Sam let us know…") so co-clients know who acted;
 * a lone client sees the second-person form ("You let us know…").
 */
export async function addPortalClientSelfNote(opts: {
  transactionId: string;
  actorContactId: string;
  actorName: string;
  side: "vendor" | "purchaser";
  /** Second-person form, e.g. "You let us know your onward purchase changed." */
  singular: string;
  /** Name-led form for co-clients; receives the actor's first name. */
  plural: (firstName: string) => string;
}): Promise<void> {
  if (opts.side !== "vendor") return; // see privacy note above
  const sameSide = await prisma.contact.findMany({
    where: { propertyTransactionId: opts.transactionId, roleType: "vendor" },
    select: { id: true },
  });
  if (sameSide.length === 0) return;
  const firstName = opts.actorName.trim().split(/\s+/)[0] || opts.actorName.trim();
  const content = sameSide.length > 1 ? opts.plural(firstName) : opts.singular;
  // internal_note + visibleToClient:true: shows in the client's own timeline
  // (the updates feed is type-agnostic on visibleToClient) without counting as
  // an `outbound` comm, which would pollute chase-timing queries.
  await prisma.outboundMessage.create({
    data: {
      transactionId: opts.transactionId,
      type: "internal_note",
      visibleToClient: true,
      contactIds: sameSide.map((c) => c.id),
      content,
    },
  });
}

/** Marks every unread notification for a user as read. Called when the bell is clicked. */
export async function markAllReadForUser(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Event D: a sale was relisted with a new buyer. Recipient is the file
 * owner who held it before the relist — assignedUser on outsourced files,
 * agentUser on self-managed. Skip-gracefully cases (no assignee on
 * outsourced — withdrawn before SP claim) are the caller's responsibility.
 *
 * The bell string is LOCKED (Ellis voice-pass, 2026-06-04; terminology
 * sweep same day — "round" → "sale" inside parens). The renderer MUST
 * use the values from the payload verbatim, no paraphrase:
 *   title:  "Sale relisted"
 *   body:   "{address} is back on: {buyerName} is the new buyer (sale {roundNumber})."
 *
 * Operationally important: the relist action fires the outsource intro
 * email to the new buyer promising contact within two working days. If
 * the SP isn't told the file is back, that promise can silently breach.
 * This bell is what makes the email's promise keepable.
 */
export async function notifyTransactionRelisted(args: {
  userId: string;
  transactionId: string;
  propertyAddress: string;
  newBuyerName: string;
  newRoundNumber: number;
}): Promise<void> {
  await createNotification({
    userId: args.userId,
    type: "transaction_relisted",
    transactionId: args.transactionId,
    payload: {
      propertyAddress: args.propertyAddress,
      newBuyerName: args.newBuyerName,
      newRoundNumber: args.newRoundNumber,
      // Pre-rendered strings so any renderer can use the locked copy
      // without re-stitching it from the parts (and accidentally drifting).
      title: "Sale relisted",
      body: `${args.propertyAddress} is back on: ${args.newBuyerName} is the new buyer (sale ${args.newRoundNumber}).`,
    },
  });
}

/** Event A: an agency-side user confirmed a milestone on an outsourced file. */
export async function notifyOutsourcedMilestoneConfirmed(args: {
  spUserId: string;
  transactionId: string;
  confirmerName: string;
  milestoneLabel: string;
  milestoneCode: string;
}): Promise<void> {
  await createNotification({
    userId: args.spUserId,
    type: "agent_outsourced_milestone_confirm",
    transactionId: args.transactionId,
    payload: {
      confirmerName: args.confirmerName,
      milestoneLabel: args.milestoneLabel,
      milestoneCode: args.milestoneCode,
    },
  });
}

/**
 * Event B: a buyer or seller confirmed a milestone via the client portal.
 * userId is the file owner whose bell should ring — assignedUser on
 * outsourced files, agentUser on self-managed (callers compute the right
 * one via `assignedUser?.id ?? agentUserId`).
 */
export async function notifyPortalMilestoneConfirmed(args: {
  userId: string;
  transactionId: string;
  contactName: string;
  contactRole: string;
  milestoneLabel: string;
  milestoneCode: string;
}): Promise<void> {
  await createNotification({
    userId: args.userId,
    type: "portal_milestone_confirm",
    transactionId: args.transactionId,
    payload: {
      contactName: args.contactName,
      contactRole: args.contactRole,
      milestoneLabel: args.milestoneLabel,
      milestoneCode: args.milestoneCode,
    },
  });
}

/**
 * Event C: a buyer or seller set an expected date on a milestone via the
 * respond page (B7's three-action UI). Same userId semantics as Event B.
 * Softer event than a confirm — surfaces in the bell + activity feed but
 * no email is sent.
 */
export async function notifyPortalExpectedDateSet(args: {
  userId: string;
  transactionId: string;
  contactName: string;
  contactRole: string;
  milestoneLabel: string;
  milestoneCode: string;
  expectedDate: Date;
}): Promise<void> {
  await createNotification({
    userId: args.userId,
    type: "portal_expected_date_set",
    transactionId: args.transactionId,
    payload: {
      contactName: args.contactName,
      contactRole: args.contactRole,
      milestoneLabel: args.milestoneLabel,
      milestoneCode: args.milestoneCode,
      expectedDate: args.expectedDate.toISOString(),
    },
  });
}

/**
 * Event D: a buyer or seller left a chase-note on the respond page.
 * Same userId semantics as Event B. The note ALSO writes a PortalMessage
 * row (existing behaviour via sendClientPortalMessage) — this notification
 * surfaces the note in the bell + activity feed alongside the messages
 * view, so it isn't easy to miss when reviewing a file.
 */
export async function notifyPortalChaseNote(args: {
  userId: string;
  transactionId: string;
  contactName: string;
  contactRole: string;
  milestoneLabel: string;
  milestoneCode: string;
  notePreview: string;
}): Promise<void> {
  await createNotification({
    userId: args.userId,
    type: "portal_chase_note",
    transactionId: args.transactionId,
    payload: {
      contactName: args.contactName,
      contactRole: args.contactRole,
      milestoneLabel: args.milestoneLabel,
      milestoneCode: args.milestoneCode,
      notePreview: args.notePreview,
    },
  });
}

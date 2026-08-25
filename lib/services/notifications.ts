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
 * switch, agent edits) so the client sees a record of what they told us.
 *
 * Privacy: the note is addressed to the actor's OWN side only. A purchaser's
 * timeline filters by their own contactId, and the vendor's timeline now shows
 * only file-wide broadcasts plus vendor-addressed notes (see getPortalTimeline),
 * so a note never crosses to the other side in either direction.
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
  const roleType = opts.side === "vendor" ? "vendor" : "purchaser";
  const sameSide = await prisma.contact.findMany({
    where: { propertyTransactionId: opts.transactionId, roleType },
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

/**
 * A mortgage buyer tapped "Request a call back" on the broker card, and the
 * broker is the agency's OWN broker (not a TSP provider). That path only sends
 * one email to the agent, which can be missed — or, if no agent email is on
 * file, sent nothing at all. This bell is the in-app trace so the request can't
 * silently stall. Recipient is the person the email targets (agentUser, falling
 * back to assignedUser) so one human gets it on both surfaces.
 *
 * The TSP-broker path doesn't need this — it logs a QuoteRequest into the
 * Command Centre quotes inbox, which is its in-app trace.
 *
 * Pre-rendered body so the bell renderer uses it verbatim (no re-stitching).
 */
export async function notifyBrokerCallbackRequested(args: {
  userId: string;
  transactionId: string;
  contactName: string;
  firmName: string;
  propertyAddress: string;
  preferredMethod: string;
}): Promise<void> {
  await createNotification({
    userId: args.userId,
    type: "broker_callback_requested",
    transactionId: args.transactionId,
    payload: {
      contactName: args.contactName,
      firmName: args.firmName,
      propertyAddress: args.propertyAddress,
      preferredMethod: args.preferredMethod,
      title: "Broker call-back requested",
      body: `${args.contactName} asked to speak with ${args.firmName} about ${args.propertyAddress}. Preferred contact: ${args.preferredMethod}.`,
    },
  });
}

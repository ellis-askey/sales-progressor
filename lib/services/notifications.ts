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

/** Marks every unread notification for a user as read. Called when the bell is clicked. */
export async function markAllReadForUser(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
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

/** Event B: a buyer or seller confirmed a milestone via the client portal. */
export async function notifyPortalMilestoneConfirmed(args: {
  spUserId: string;
  transactionId: string;
  contactName: string;
  contactRole: string;
  milestoneLabel: string;
  milestoneCode: string;
}): Promise<void> {
  await createNotification({
    userId: args.spUserId,
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

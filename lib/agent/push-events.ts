// High-level helpers for agent-facing push events. Each helper:
//   1. Resolves the file owner (assignedUserId ?? agentUserId)
//   2. Fetches their notification prefs
//   3. Fires pushToUser only if the relevant per-event toggle is on
//
// Keeps the call sites in actions/services tidy — they call a one-liner like
// `pushChaseEscalation(transactionId)` instead of duplicating the lookup +
// pref check + push call at every site.
//
// All helpers are fire-and-forget: they swallow their own errors so a missed
// push never breaks the primary action.

import { prisma } from "@/lib/prisma";
import { pushToUser } from "@/lib/services/push";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import type { PushKey } from "@/lib/agent/notification-prefs";

function shortAddress(propertyAddress: string): string {
  return propertyAddress.split(",")[0] ?? propertyAddress;
}

// Resolves file owner + dashboard URL + pushes only if the user has the
// supplied push toggle enabled. Returns nothing — fire-and-forget.
async function pushToFileOwner(args: {
  transactionId: string;
  key: PushKey;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: args.transactionId },
      select: { id: true, assignedUserId: true, agentUserId: true },
    });
    if (!tx) return;

    const userId = tx.assignedUserId ?? tx.agentUserId;
    if (!userId) return;

    const prefs = await getNotificationPrefs(userId);
    if (!prefs.push[args.key]) return;

    const base = process.env.NEXTAUTH_URL ?? "";
    await pushToUser(userId, {
      title: args.title,
      body:  args.body,
      url:   `${base}/transactions/${tx.id}`,
    });
  } catch (err) {
    console.error(`[push-events] ${args.key} failed for tx ${args.transactionId}:`, err);
  }
}

// A chase task on this file just escalated (chaseCount >= escalateAfterChases,
// or the agent manually clicked "Escalate"). Fires once per transition.
export async function pushChaseEscalation(
  transactionId: string,
  milestoneLabel: string | null,
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { propertyAddress: true },
  });
  if (!tx) return;
  await pushToFileOwner({
    transactionId,
    key: "chaseEscalation",
    title: milestoneLabel ? `Escalated: ${milestoneLabel}` : "Chase escalated",
    body:  shortAddress(tx.propertyAddress),
  });
}

// A file was assigned (or reassigned) to a user. NOTE this one bypasses the
// pushToFileOwner helper because the recipient is the NEW assignee, not the
// resolved file-owner (which may not be them at the moment of assignment).
export async function pushFileAssigned(args: {
  transactionId: string;
  assigneeUserId: string;
  assignerName: string;
}): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(args.assigneeUserId);
    if (!prefs.push.fileAssigned) return;

    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: args.transactionId },
      select: { propertyAddress: true },
    });
    if (!tx) return;

    const base = process.env.NEXTAUTH_URL ?? "";
    await pushToUser(args.assigneeUserId, {
      title: `New file assigned to you`,
      body:  shortAddress(tx.propertyAddress),
      url:   `${base}/transactions/${args.transactionId}`,
    });
  } catch (err) {
    console.error(`[push-events] fileAssigned failed for tx ${args.transactionId}:`, err);
  }
}

// Exchange target is within 7 days. Caller is responsible for dedup —
// typically a daily cron that fires once per file per warning window.
export async function pushExchangeApproaching(
  transactionId: string,
  daysUntil: number,
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { propertyAddress: true },
  });
  if (!tx) return;
  const body = daysUntil <= 0
    ? `${shortAddress(tx.propertyAddress)} — exchange target is today`
    : daysUntil === 1
      ? `${shortAddress(tx.propertyAddress)} — exchange target is tomorrow`
      : `${shortAddress(tx.propertyAddress)} — exchange target in ${daysUntil} days`;
  await pushToFileOwner({
    transactionId,
    key: "exchangeApproaching",
    title: "Exchange approaching",
    body,
  });
}

// A chain event affecting this file (lost buyer / lost purchase / asked to
// wait / wait nudge / decline). Caller passes the recipient userId directly
// because the chain notification queue already knows who to address — no
// need to re-resolve the file owner.
export async function pushChainEvent(args: {
  recipientUserId: string;
  transactionId: string | null;
  propertyAddress: string;
  kind: "LOST_BUYER" | "LOST_PURCHASE" | "ASKED_TO_WAIT" | "WAIT_NUDGE" | "DECLINE";
}): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(args.recipientUserId);
    if (!prefs.push.chainEvent) return;

    const titleMap: Record<typeof args.kind, string> = {
      LOST_BUYER:    "Chain update: buyer fell through",
      LOST_PURCHASE: "Chain update: purchase fell through",
      ASKED_TO_WAIT: "Chain update: asked to wait",
      WAIT_NUDGE:    "Still waiting — chain update needed",
      DECLINE:       "Chain invite declined",
    };

    const base = process.env.NEXTAUTH_URL ?? "";
    const url = args.transactionId
      ? `${base}/transactions/${args.transactionId}`
      : `${base}/agent/hub`;

    await pushToUser(args.recipientUserId, {
      title: titleMap[args.kind],
      body:  shortAddress(args.propertyAddress),
      url,
    });
  } catch (err) {
    console.error(`[push-events] chainEvent ${args.kind} failed:`, err);
  }
}

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
  // Title kept as "Escalated: {milestone name}" — the milestone-name data
  // (reminderRule.name minus "Chase:" prefix) reads as past-tense / done
  // phrasing ("Buyer has booked their survey"), so we can't rewrite to a
  // not-yet-done form without changing the underlying data. Body bumps to
  // include a clear action prompt.
  const short = shortAddress(tx.propertyAddress);
  await pushToFileOwner({
    transactionId,
    key: "chaseEscalation",
    title: milestoneLabel ? `Escalated: ${milestoneLabel}` : "Chase escalated",
    body:  `${short} · needs a chase`,
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
    // Title now names the assigner so the agent knows WHO put it on their
    // plate — the data is already captured in args.assignerName.
    await pushToUser(args.assigneeUserId, {
      title: `${args.assignerName} assigned you a file`,
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
  // Title now carries the urgency (today / tomorrow / N days); body is just
  // the address. Reads faster on a lock-screen line than the old "Exchange
  // approaching · address — target in N days" stack.
  const title = daysUntil <= 0
    ? "Exchange target: today"
    : daysUntil === 1
      ? "Exchange target: tomorrow"
      : `Exchange target: ${daysUntil} days`;
  await pushToFileOwner({
    transactionId,
    key: "exchangeApproaching",
    title,
    body: shortAddress(tx.propertyAddress),
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
  // Closed-loop arc (2026-06-05) — BUYER_FOUND + CHAIN_DETACHED added.
  // BUYER_FOUND surfaces "the chain has reformed" with a "tap to review"
  // cue (most agents will want to confirm their stance). CHAIN_DETACHED
  // is informational — no action required from the recipient, hence the
  // softer "your chain has shortened" body.
  kind: "LOST_BUYER" | "LOST_PURCHASE" | "ASKED_TO_WAIT" | "WAIT_NUDGE" | "DECLINE" | "BUYER_FOUND" | "CHAIN_DETACHED";
}): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(args.recipientUserId);
    if (!prefs.push.chainEvent) return;

    const titleMap: Record<typeof args.kind, string> = {
      LOST_BUYER:     "Chain update: the buyer has pulled out",
      LOST_PURCHASE:  "Chain update: the purchase has fallen through",
      ASKED_TO_WAIT:  "Chain update: can your client wait?",
      WAIT_NUDGE:     "Still waiting on this chain",
      DECLINE:        "Chain invite declined",
      BUYER_FOUND:    "Chain update: a new buyer has been secured below you",
      CHAIN_DETACHED: "Chain update: your chain has been shortened",
    };
    const bodyMap: Record<typeof args.kind, string> = {
      LOST_BUYER:     `${shortAddress(args.propertyAddress)} · tap to respond`,
      LOST_PURCHASE:  `${shortAddress(args.propertyAddress)} · tap to respond`,
      ASKED_TO_WAIT:  `${shortAddress(args.propertyAddress)} · tap to respond`,
      WAIT_NUDGE:     `${shortAddress(args.propertyAddress)} · an update is needed`,
      DECLINE:        shortAddress(args.propertyAddress),
      BUYER_FOUND:    `${shortAddress(args.propertyAddress)} · tap to review`,
      CHAIN_DETACHED: `${shortAddress(args.propertyAddress)} · your chain has shortened`,
    };

    const base = process.env.NEXTAUTH_URL ?? "";
    const url = args.transactionId
      ? `${base}/transactions/${args.transactionId}`
      : `${base}/agent/hub`;

    await pushToUser(args.recipientUserId, {
      title: titleMap[args.kind],
      body:  bodyMap[args.kind],
      url,
    });
  } catch (err) {
    console.error(`[push-events] chainEvent ${args.kind} failed:`, err);
  }
}

// A withdrawn file the user owned was just relisted with a new buyer.
// LOCKED COPY (Ellis voice-pass, 2026-06-04; terminology sweep same
// day — "round" → "sale" inside the body parens): "Sale relisted" /
// "{address} is back on: {buyerName} is the new buyer (sale {round})."
// MUST NOT be paraphrased — see notifyTransactionRelisted in
// lib/services/notifications.ts for the matching rule.
//
// Recipient is the existing file owner (assignedUser on outsourced /
// agentUser on self-managed). Caller passes the chosen userId in
// directly — push-events doesn't second-guess the assignment policy
// (continuity, baked in relistTransactionImpl).
export async function pushTransactionRelisted(args: {
  recipientUserId: string;
  transactionId: string;
  propertyAddress: string;
  newBuyerName: string;
  newRoundNumber: number;
}): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(args.recipientUserId);
    if (!prefs.push.saleRelisted) return;

    const base = process.env.NEXTAUTH_URL ?? "";
    await pushToUser(args.recipientUserId, {
      title: "Sale relisted",
      body:  `${args.propertyAddress} is back on: ${args.newBuyerName} is the new buyer (sale ${args.newRoundNumber}).`,
      url:   `${base}/transactions/${args.transactionId}`,
    });
  } catch (err) {
    console.error(`[push-events] saleRelisted failed for tx ${args.transactionId}:`, err);
  }
}

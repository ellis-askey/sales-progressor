// lib/chain/withdrawal.ts
// Step-wise chain cascade — withdraw, remarketing, and buyer-found.
//
// Model: one notification at a time per direction. The walker stops at the
// first WITHDRAWN / BREAK_CHAIN link (chain is broken at that point) and
// SKIPS unclaimed links.
//
// Closed-loop arc (2026-06-05) — three cascade kinds now route through
// this file:
//   1. cascadeChainWithdrawal — direction-aware. Caller chooses which
//      direction(s) to walk based on the WithdrawalReason classification
//      captured at withdraw time (see changeStatusAction). Replaces the
//      pre-arc behaviour of always firing both directions.
//   2. cascadeChainRemarketing — unchanged. Fired when an agent responds
//      REMARKETING to a LOST_BUYER / LOST_PURCHASE; sends ASKED_TO_WAIT
//      one step further in the same direction.
//   3. cascadeChainBuyerFound — new. Fired at relist STEP 12b to tell
//      upstream neighbours from the original withdraw cascade that the
//      chain has reformed. Per-recipient variant copy: silent for
//      WITHDRAW + BREAK_CHAIN responders, "wait is over" for WAITING,
//      "stop remarketing" for REMARKETING, "disregard the earlier note"
//      for no-response.

import { prisma } from "@/lib/prisma";
import { fireChainCascadeNotifications } from "@/lib/email/chainNotifications";
import { retireOnwardTrackerForWithdrawnLink } from "@/lib/services/onward";
import type { ChainDirection, ChainNotificationType, ChainWithdrawalStatus } from "@prisma/client";

type NearestClaimed = {
  id: string;
  position: number;
  claimedByUserId: string;
  claimedByEmail: string;
};

/**
 * Walk the chain in `direction` from `fromPosition`, returning the first link
 * that is claimed AND not WITHDRAWN. Returns null when:
 *   - the walk reaches the chain end without finding one, OR
 *   - the walk hits a WITHDRAWN link (chain broken — anything past it isn't
 *     "in the same cascade" from this side's perspective).
 * Unclaimed links are skipped.
 *
 * BREAK_CHAIN responses are stored on ChainNotificationQueue.response, not
 * on ChainLink.withdrawalStatus, so they don't stop this walker. The
 * buyer-found cascade applies the BREAK_CHAIN silence separately at the
 * per-recipient stage (see cascadeChainBuyerFound).
 */
export async function findNearestClaimedLink(
  chainId: string,
  fromPosition: number,
  direction: ChainDirection,
): Promise<NearestClaimed | null> {
  // Position convention in the codebase: dbPosition 0 = TOP of the chain
  // (confirmed by createChainV2 — "above stubs at positions 0..n-1" — and
  // displayChainPosition's "DB position 0 (top of chain)" comment). The
  // widget renders position ASC, so position 0 is at the top of the visible
  // list = top of the chain hierarchy.
  //
  // UPWARD means "walk toward the top of the chain" = walk toward LOWER
  // positions. Pre-arc the code used `gt: fromPosition` for UPWARD which
  // walked toward HIGHER positions — opposite of the intent. The bug
  // didn't surface in pre-launch testing because every rehearsal chain
  // was only two links wide; direction couldn't be wrong when there was
  // only one neighbour to reach. Caught in the closed-loop arc walkthrough
  // when F2's 4-link chain put the bug on screen (BUYER_WITHDREW sent
  // LOST_BUYER to the agent BELOW Emily instead of Tom above her).
  const links = await prisma.chainLink.findMany({
    where: {
      chainId,
      position: direction === "UPWARD" ? { lt: fromPosition } : { gt: fromPosition },
    },
    orderBy: { position: direction === "UPWARD" ? "desc" : "asc" },
    select: {
      id: true,
      position: true,
      claimedByUserId: true,
      withdrawalStatus: true,
      claimedBy: { select: { email: true } },
    },
  });

  for (const link of links) {
    if (link.withdrawalStatus === "WITHDRAWN") return null; // chain broken
    if (!link.claimedByUserId || !link.claimedBy?.email) continue; // unclaimed, keep walking
    return {
      id: link.id,
      position: link.position,
      claimedByUserId: link.claimedByUserId,
      claimedByEmail: link.claimedBy.email,
    };
  }
  return null;
}

function notificationTypeForWithdrawalDirection(direction: ChainDirection): ChainNotificationType {
  // Cascade going UPWARD reaches an agent who lost their buyer (their buyer
  // was the withdrawing party below them). Cascade DOWNWARD reaches an agent
  // who lost their purchase (the property they were buying is gone).
  return direction === "UPWARD" ? "LOST_BUYER" : "LOST_PURCHASE";
}

/**
 * Fired when a transaction is marked withdrawn (initial trigger) OR when an
 * agent responds WITHDRAW to a prior notification. The caller supplies the
 * directions to walk — derived from the structured WithdrawalReason at the
 * call site:
 *
 *   BUYER_WITHDREW       → ["UPWARD"]
 *   SELLER_WITHDREW      → ["DOWNWARD"]
 *   CHAIN_COLLAPSE_ABOVE → [] (upstream cascade already in motion; this is
 *                              just our local link withdrawal — orphan
 *                              detach happens via cascadeChainSplit, not
 *                              here)
 *   OTHER                → ["UPWARD", "DOWNWARD"] (conservative — tell both)
 *
 * Idempotent on the link-side write: marking a link WITHDRAWN twice is
 * harmless. The notification insert is per-call (a fresh trigger produces
 * fresh notifications), so callers must not invoke this more than once per
 * actual withdrawal event.
 */
export async function cascadeChainWithdrawal(
  withdrawingLinkId: string,
  directions: readonly ChainDirection[] = ["UPWARD", "DOWNWARD"],
): Promise<void> {
  const link = await prisma.chainLink.findUnique({
    where: { id: withdrawingLinkId },
    select: { id: true, chainId: true, position: true, withdrawalStatus: true },
  });
  if (!link) return;

  if (link.withdrawalStatus !== "WITHDRAWN") {
    await prisma.chainLink.update({
      where: { id: withdrawingLinkId },
      data: { withdrawalStatus: "WITHDRAWN" },
    });
    // Onward-visibility: the seller below this link was buying it as their
    // onward, so auto-retire their reported onward tracker. Best-effort.
    retireOnwardTrackerForWithdrawnLink(withdrawingLinkId).catch((err) =>
      console.error(`[onward retire] failed for withdrawn link ${withdrawingLinkId}:`, err),
    );
  }

  for (const direction of directions) {
    const next = await findNearestClaimedLink(link.chainId, link.position, direction);
    if (!next) continue;

    await prisma.chainNotificationQueue.create({
      data: {
        chainId: link.chainId,
        triggeringLinkId: withdrawingLinkId,
        recipientLinkId: next.id,
        recipientUserId: next.claimedByUserId,
        recipientEmail: next.claimedByEmail,
        type: notificationTypeForWithdrawalDirection(direction),
        direction,
      },
    });
  }

  console.log(
    `[CHAIN_CASCADE_WITHDRAWAL] chain=${link.chainId} triggeringLink=${withdrawingLinkId} directions=${directions.join(",") || "(none)"}`,
  );

  // Best-effort synchronous fire; the daily drain cron is the fallback
  await fireChainCascadeNotifications().catch(console.error);
}

/**
 * Fired when an agent responds REMARKETING to a LOST_BUYER or LOST_PURCHASE.
 * Sends ASKED_TO_WAIT to the next claimed link in the same direction the
 * original notification came from (so an agent re-marketing for a new buyer
 * asks their seller-side neighbour to wait, etc.).
 */
export async function cascadeChainRemarketing(
  respondingLinkId: string,
  originalDirection: ChainDirection,
): Promise<void> {
  const link = await prisma.chainLink.findUnique({
    where: { id: respondingLinkId },
    select: { id: true, chainId: true, position: true },
  });
  if (!link) return;

  const next = await findNearestClaimedLink(link.chainId, link.position, originalDirection);
  if (!next) return;

  await prisma.chainNotificationQueue.create({
    data: {
      chainId: link.chainId,
      triggeringLinkId: respondingLinkId,
      recipientLinkId: next.id,
      recipientUserId: next.claimedByUserId,
      recipientEmail: next.claimedByEmail,
      type: "ASKED_TO_WAIT",
      direction: originalDirection,
    },
  });

  console.log(
    `[CHAIN_CASCADE_REMARKETING] chain=${link.chainId} triggeringLink=${respondingLinkId} direction=${originalDirection}`,
  );

  await fireChainCascadeNotifications().catch(console.error);
}

/**
 * Fired at relist STEP 12b. Walks UPWARD from the relisting link, telling
 * every neighbour who was reached by the ORIGINAL withdraw cascade that
 * the chain has reformed. Per-recipient response gates whether the
 * BUYER_FOUND fires at all:
 *
 *   No prior response   → fire (variant: "default")
 *   WAITING             → fire (variant: "WAITING" — wait is over)
 *   REMARKETING         → fire (variant: "REMARKETING" — stop remarketing)
 *   WITHDRAW            → SKIP (they've withdrawn their own file; informing
 *                                them doesn't undo their finality, and per
 *                                Ellis lock 2026-06-05 they're treated as
 *                                "moved on")
 *   BREAK_CHAIN         → SKIP (deliberate finality — do not re-engage)
 *
 * The recipientLinkId, recipientUserId, recipientEmail are reused from the
 * matched original LOST_BUYER row so the email lands in the same inbox
 * even if the agent's account email changed (the row is a frozen audit of
 * who got told what).
 *
 * Idempotent against double-relist: if a previous BUYER_FOUND row for the
 * same recipientLinkId is still unsent, it's left in place and no new row
 * is created. If it was sent already, a fresh row is queued — the recipient
 * gets a second "we have a buyer" email, which is fine on a second relist.
 */
export async function cascadeChainBuyerFound(
  relistingLinkId: string,
): Promise<{ queued: number; skipped: number }> {
  const link = await prisma.chainLink.findUnique({
    where: { id: relistingLinkId },
    select: { id: true, chainId: true, position: true },
  });
  if (!link) return { queued: 0, skipped: 0 };

  // Original LOST_BUYER cascade rows — the source of truth for "who did we
  // tell during the withdraw". We replay against the same recipients only.
  const originals = await prisma.chainNotificationQueue.findMany({
    where: {
      chainId: link.chainId,
      triggeringLinkId: relistingLinkId,
      type: "LOST_BUYER",
    },
    select: {
      id: true,
      recipientLinkId: true,
      recipientUserId: true,
      recipientEmail: true,
      response: true,
      respondedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (originals.length === 0) {
    console.log(
      `[CHAIN_CASCADE_BUYER_FOUND] chain=${link.chainId} relistingLink=${relistingLinkId} no original LOST_BUYER rows to replay`,
    );
    return { queued: 0, skipped: 0 };
  }

  // De-duplicate to one row per recipientLinkId (the most recent).
  const seen = new Set<string>();
  const latestByRecipient: typeof originals = [];
  for (const row of originals) {
    if (seen.has(row.recipientLinkId)) continue;
    seen.add(row.recipientLinkId);
    latestByRecipient.push(row);
  }

  let queued = 0;
  let skipped = 0;

  for (const original of latestByRecipient) {
    if (original.response === "WITHDRAWN" || original.response === "BREAK_CHAIN") {
      skipped++;
      continue;
    }

    // Suppress double-fire when a previous BUYER_FOUND is still in the
    // queue unsent. Lets us call this idempotently from the relist commit
    // path without worrying about retries enqueueing duplicates.
    const inFlight = await prisma.chainNotificationQueue.findFirst({
      where: {
        chainId: link.chainId,
        triggeringLinkId: relistingLinkId,
        recipientLinkId: original.recipientLinkId,
        type: "BUYER_FOUND",
        emailSentAt: null,
      },
      select: { id: true },
    });
    if (inFlight) {
      skipped++;
      continue;
    }

    await prisma.chainNotificationQueue.create({
      data: {
        chainId: link.chainId,
        triggeringLinkId: relistingLinkId,
        recipientLinkId: original.recipientLinkId,
        recipientUserId: original.recipientUserId,
        recipientEmail: original.recipientEmail,
        type: "BUYER_FOUND",
        direction: "UPWARD",
      },
    });
    queued++;
  }

  console.log(
    `[CHAIN_CASCADE_BUYER_FOUND] chain=${link.chainId} relistingLink=${relistingLinkId} queued=${queued} skipped=${skipped}`,
  );

  await fireChainCascadeNotifications().catch(console.error);

  return { queued, skipped };
}

/**
 * Looks up the recipient's prior LOST_BUYER response for a BUYER_FOUND row.
 * Drives copy variant selection at email-send time (see
 * buildBuyerFoundEmailPayload in lib/email/chainNotifications.ts).
 *
 * Match key: same triggeringLinkId + recipientLinkId, type=LOST_BUYER. We
 * pick the most recently created row for safety against second-relist
 * scenarios (multiple LOST_BUYER rows can exist for the same pair).
 *
 * Returns null when no original row is found — the variant defaults to
 * "default" copy in that case.
 */
export async function getPriorResponseForBuyerFound(
  buyerFoundRowId: string,
): Promise<ChainWithdrawalStatus | null> {
  const row = await prisma.chainNotificationQueue.findUnique({
    where: { id: buyerFoundRowId },
    select: { triggeringLinkId: true, recipientLinkId: true },
  });
  if (!row) return null;
  const prior = await prisma.chainNotificationQueue.findFirst({
    where: {
      triggeringLinkId: row.triggeringLinkId,
      recipientLinkId: row.recipientLinkId,
      type: "LOST_BUYER",
    },
    orderBy: { createdAt: "desc" },
    select: { response: true },
  });
  return prior?.response ?? null;
}

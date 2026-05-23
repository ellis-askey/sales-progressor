// lib/chain/withdrawal.ts
// Step-wise chain withdrawal cascade.
//
// Model: one notification at a time per direction. When a transaction is
// withdrawn (or an agent responds WITHDRAW to a prior notification), we walk
// the chain one link at a time looking for the nearest claimed neighbour in
// each direction. The walk STOPS at the first WITHDRAWN link (chain is
// broken at that point) and SKIPS unclaimed links.
//
// REMARKETING responses propagate one step (ASKED_TO_WAIT) in the same
// direction as the incoming notification. WAITING / BREAK_CHAIN are terminal.

import { prisma } from "@/lib/prisma";
import { fireChainCascadeNotifications } from "@/lib/email/chainNotifications";
import type { ChainDirection, ChainNotificationType } from "@prisma/client";

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
 */
export async function findNearestClaimedLink(
  chainId: string,
  fromPosition: number,
  direction: ChainDirection,
): Promise<NearestClaimed | null> {
  const links = await prisma.chainLink.findMany({
    where: {
      chainId,
      position: direction === "UPWARD" ? { gt: fromPosition } : { lt: fromPosition },
    },
    orderBy: { position: direction === "UPWARD" ? "asc" : "desc" },
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
 * agent responds WITHDRAW to a prior notification. Walks both directions; the
 * stop-at-WITHDRAWN traversal naturally scopes the cascade to the unbroken
 * segment of the chain.
 *
 * Idempotent: marking a link WITHDRAWN twice is harmless. The notification
 * insert is per-call (a fresh trigger produces fresh notifications), so
 * callers must not invoke this more than once per actual withdrawal event.
 */
export async function cascadeChainWithdrawal(withdrawingLinkId: string): Promise<void> {
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
  }

  for (const direction of ["UPWARD", "DOWNWARD"] as const) {
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

  console.log(`[CHAIN_CASCADE_WITHDRAWAL] chain=${link.chainId} triggeringLink=${withdrawingLinkId}`);

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

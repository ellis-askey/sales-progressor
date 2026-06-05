// lib/chain/split.ts
//
// Chain split — orphan-segment detachment on withdraw.
//
// When a withdrawal disconnects part of the chain (the buyer's onward
// chain leaves with the departing buyer; the seller's upstream chain
// leaves with the departing seller), the orphan segment is moved to its
// own PropertyChain row. The orphan's links keep their positions, their
// claim state, their stub data — only their `chainId` flips to point at
// the new chain row, and a per-link audit pair (`detachedAt` +
// `detachedFromChainId`) is stamped.
//
// The agent at the highest claimed position in the orphan segment gets a
// CHAIN_DETACHED notification telling them their chain has been
// shortened.
//
// Closed-loop chain arc (2026-06-05). Per Ellis-lock 2026-06-05 the
// cascade is fully closed: no silent dangling links, no surprise data
// loss, the archived round drawer records the split via
// BuyerRound.chainSnapshot.

import { prisma } from "@/lib/prisma";
import { fireChainCascadeNotifications } from "@/lib/email/chainNotifications";
import type { Prisma, ChainDirection } from "@prisma/client";

export type SplitChainArgs = {
  // The link of the withdrawing transaction — the boundary at which the
  // chain breaks. Stays in the original chain. Anything strictly past it
  // in the `orphanDirection` moves to a new chain.
  withdrawingLinkId: string;
  // Which side of the boundary detaches. BUYER_WITHDREW + CHAIN_COLLAPSE_ABOVE
  // detach downstream (the buyer's onward chain); SELLER_WITHDREW detaches
  // upstream (the seller's onward purchase chain).
  orphanDirection: ChainDirection;
  // Passed through to the new PropertyChain row. Mirrors the original
  // chain's agency — the orphan segment is "owned" by the agencies of
  // the agents managing it; using the originating tx's agency for the
  // PropertyChain.agencyId metadata field matches how chain rows are
  // created today.
  agencyId: string;
  // tx that triggered the split (for audit + the CHAIN_DETACHED email
  // copy — "[address] has been marked withdrawn").
  withdrawingTransactionId: string;
};

export type SplitChainResult =
  | { kind: "noop"; reason: "no_orphan_links" | "withdrawing_link_not_found" }
  | {
      kind: "split";
      orphanChainId: string;
      orphanLinkIds: string[];
      // Recipient set for the CHAIN_DETACHED notification. Today we send
      // to the highest claimed position in the orphan segment; we surface
      // ALL claimed positions in case future iterations want to fan out.
      claimedOrphanLinks: Array<{
        id: string;
        position: number;
        claimedByUserId: string;
        claimedByEmail: string;
      }>;
      notifiedRecipientLinkId: string | null;
    };

/**
 * Move every link strictly past `withdrawingLinkId` in `orphanDirection`
 * onto a fresh PropertyChain row, stamp the per-link audit fields, and fire
 * a single CHAIN_DETACHED notification to the highest claimed link in the
 * orphan segment.
 *
 * Returns { kind: "noop" } when there's no orphan to detach — the
 * withdrawing link is at the boundary of its chain in the orphan direction
 * (e.g. BUYER_WITHDREW on a file with no downstream links).
 *
 * Runs inside the caller's $transaction when `tx` is provided. Keeps the
 * notification fire as a fire-and-forget after the commit (so a failed
 * email doesn't roll back the split).
 */
export async function splitChainAtBoundary(
  args: SplitChainArgs,
  tx?: Prisma.TransactionClient,
): Promise<SplitChainResult> {
  const db = tx ?? prisma;

  const withdrawing = await db.chainLink.findUnique({
    where: { id: args.withdrawingLinkId },
    select: { id: true, chainId: true, position: true },
  });
  if (!withdrawing) {
    return { kind: "noop", reason: "withdrawing_link_not_found" };
  }

  // Orphan = every link strictly past the boundary in the orphan direction.
  const positionFilter =
    args.orphanDirection === "UPWARD"
      ? { gt: withdrawing.position }
      : { lt: withdrawing.position };

  const orphans = await db.chainLink.findMany({
    where: { chainId: withdrawing.chainId, position: positionFilter },
    select: {
      id: true,
      position: true,
      claimedByUserId: true,
      claimedBy: { select: { email: true } },
    },
    orderBy: { position: args.orphanDirection === "UPWARD" ? "desc" : "asc" },
  });

  if (orphans.length === 0) {
    return { kind: "noop", reason: "no_orphan_links" };
  }

  // Fresh chain row for the orphan segment. Mirrors the original chain's
  // agencyId; no name (the original's name referred to the now-broken
  // whole). Status default ACTIVE — the orphan continues to function as
  // its own chain.
  const newChain = await db.propertyChain.create({
    data: {
      agencyId: args.agencyId,
    },
    select: { id: true },
  });

  const detachedAt = new Date();
  await db.chainLink.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: {
      chainId: newChain.id,
      detachedAt,
      detachedFromChainId: withdrawing.chainId,
    },
  });

  // Highest claimed link in the orphan = closest to where the chain was
  // broken. They feel the loss most directly; they're the right CHAIN_DETACHED
  // recipient. `orphans` is already sorted with the closest-to-boundary
  // link first (DESC for UPWARD orphans, ASC for DOWNWARD orphans).
  const claimedOrphanLinks = orphans
    .filter(
      (o): o is typeof o & { claimedByUserId: string; claimedBy: { email: string } } =>
        Boolean(o.claimedByUserId) && Boolean(o.claimedBy?.email),
    )
    .map((o) => ({
      id: o.id,
      position: o.position,
      claimedByUserId: o.claimedByUserId,
      claimedByEmail: o.claimedBy.email,
    }));

  let notifiedRecipientLinkId: string | null = null;
  if (claimedOrphanLinks.length > 0) {
    const recipient = claimedOrphanLinks[0];
    notifiedRecipientLinkId = recipient.id;
    await db.chainNotificationQueue.create({
      data: {
        // Notification is created in the NEW chain — it's about that
        // orphan chain's shape. The triggering link is our withdrawing
        // link, which stayed in the original chain. Both references are
        // valid foreign keys regardless of which chain holds which row.
        chainId: newChain.id,
        triggeringLinkId: args.withdrawingLinkId,
        recipientLinkId: recipient.id,
        recipientUserId: recipient.claimedByUserId,
        recipientEmail: recipient.claimedByEmail,
        type: "CHAIN_DETACHED",
        direction: args.orphanDirection,
      },
    });
  }

  console.log(
    `[CHAIN_SPLIT] fromChain=${withdrawing.chainId} toChain=${newChain.id} orphans=${orphans.length} direction=${args.orphanDirection} notified=${notifiedRecipientLinkId ?? "none"}`,
  );

  // Fire-and-forget the email. The caller's $transaction may not have
  // committed yet — fireChainCascadeNotifications uses the outer prisma
  // client, so the row will be visible by the time the cron drain runs
  // even if this synchronous fire races against the transaction commit.
  if (!tx) {
    void fireChainCascadeNotifications().catch(console.error);
  }

  return {
    kind: "split",
    orphanChainId: newChain.id,
    orphanLinkIds: orphans.map((o) => o.id),
    claimedOrphanLinks,
    notifiedRecipientLinkId,
  };
}

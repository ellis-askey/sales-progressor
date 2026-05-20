// lib/chain/withdrawal.ts
// Withdrawal cascade — notification queue, link state changes, and synchronous email fire.

import { prisma } from "@/lib/prisma";
import { fireWithdrawalNotifications } from "@/lib/email/chainNotifications";

export async function notifyChainMatesOfWithdrawal(
  withdrawingTransactionId: string,
  withdrawingUserId: string,
  fallThroughReason: string | null,
): Promise<void> {
  // Find the withdrawing transaction's chain link
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: withdrawingTransactionId },
    select: { chainLinkId: true },
  });
  if (!tx?.chainLinkId) return;

  const withdrawingLinkId = tx.chainLinkId;

  // Guard: if already marked WITHDRAWN, a previous call processed this — skip
  const existingLink = await prisma.chainLink.findUnique({
    where: { id: withdrawingLinkId },
    select: { withdrawalStatus: true, chainId: true },
  });
  if (!existingLink) return;
  if (existingLink.withdrawalStatus === "WITHDRAWN") return;

  // Mark the withdrawing agent's own link as WITHDRAWN
  await prisma.chainLink.update({
    where: { id: withdrawingLinkId },
    data: { withdrawalStatus: "WITHDRAWN" },
  });

  // Find all other claimed links in the same chain
  const mates = await prisma.chainLink.findMany({
    where: {
      chainId: existingLink.chainId,
      inviteStatus: "CLAIMED",
      transactionId: { not: null },
      id: { not: withdrawingLinkId },
    },
    select: {
      id: true,
      claimedByUserId: true,
      claimedBy: { select: { email: true } },
    },
  });

  const notifiable = mates.filter((m) => m.claimedByUserId && m.claimedBy?.email);
  if (notifiable.length === 0) return;

  await prisma.chainNotificationQueue.createMany({
    data: notifiable.map((mate) => ({
      chainId: existingLink.chainId,
      withdrawingTransactionId,
      withdrawingUserId,
      withdrawingReason: fallThroughReason,
      recipientUserId: mate.claimedByUserId!,
      recipientLinkId: mate.id,
      recipientEmail: mate.claimedBy!.email!,
    })),
    skipDuplicates: true,
  });

  console.log(
    `[WITHDRAWAL_NOTIFICATION_QUEUED] chain=${existingLink.chainId} ` +
    `withdrawing=${withdrawingTransactionId} recipients=${notifiable.length} ` +
    `reason=${fallThroughReason ? "present" : "absent"}`,
  );

  // Fire synchronously — if send fails the records remain for the hourly cron fallback
  await fireWithdrawalNotifications().catch(console.error);
}

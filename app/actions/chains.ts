"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere, scopeTransactionWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";

// Confirm a live sale needs no chain — it leaves the "Needs chain setup" queue
// and lands in the "No chain" tab, so the queue can reach zero. Reversible via
// undoNoChainAction. Scope-guarded (Law 7): only a file in the caller's access
// scope can be marked, so an agency user can only ever touch their own sales.
export async function confirmNoChainAction(transactionId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, chainLinkId: true, noChainNeededAt: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.chainLinkId) throw new Error("This sale is already in a chain");
  if (tx.noChainNeededAt) return; // already confirmed — idempotent

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { noChainNeededAt: new Date(), noChainNeededById: session.user.id },
  });
  await logActivity(transactionId, `${session.user.name} confirmed no chain is needed.`, session.user.id);
  revalidatePath("/agent/chains");
  // The file's Overview chain card reads this flag too — keep an open file tab in sync.
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  revalidatePath(`/transactions/${transactionId}`, "page");
}

// Undo — put the sale back in the setup queue.
export async function undoNoChainAction(transactionId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, noChainNeededAt: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (!tx.noChainNeededAt) return; // already open — idempotent

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { noChainNeededAt: null, noChainNeededById: null },
  });
  await logActivity(transactionId, `${session.user.name} reopened the sale for chain setup.`, session.user.id);
  revalidatePath("/agent/chains");
  // The file's Overview chain card reads this flag too — keep an open file tab in sync.
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
  revalidatePath(`/transactions/${transactionId}`, "page");
}

// Mark that we've chased another agent about their sale in one of our chains —
// stamps ChainLink.lastAgentChasedAt so it drops down the Check-ins list and the
// "chased N ago" reads true. Scope-guarded: the link's chain must contain one of
// the caller's in-scope sales, so you can only touch chains you're actually in.
// (critique 2026-10-02)
export async function markChainLinkChasedAction(
  chainLinkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const link = await prisma.chainLink.findUnique({ where: { id: chainLinkId }, select: { chainId: true } });
  if (!link) return { ok: false, error: "That link no longer exists." };
  const inScope = await prisma.propertyTransaction.findFirst({
    where: { AND: [scopeTransactionWhere(scope), { chainLink: { chainId: link.chainId } }] },
    select: { id: true },
  });
  if (!inScope) return { ok: false, error: "That chain isn't one of yours." };
  await prisma.chainLink.update({ where: { id: chainLinkId }, data: { lastAgentChasedAt: new Date() } });
  revalidatePath("/agent/chains");
  return { ok: true };
}

// Exchange-push: confirm (or un-confirm) that another sale in one of our chains
// is ready to exchange — our manual override, set as we chase round. Stamps
// ChainLink.exchangeReadyConfirmedAt. Scope-guarded to chains the caller is in.
// Used by both the file Overview panel and the chains "Push to exchange" tab, so
// a tick in one shows in the other. (critique 2026-10-02)
export async function setChainLinkExchangeReadyAction(
  chainLinkId: string,
  ready: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const link = await prisma.chainLink.findUnique({ where: { id: chainLinkId }, select: { chainId: true } });
  if (!link) return { ok: false, error: "That link no longer exists." };
  const inScope = await prisma.propertyTransaction.findFirst({
    where: { AND: [scopeTransactionWhere(scope), { chainLink: { chainId: link.chainId } }] },
    select: { id: true },
  });
  if (!inScope) return { ok: false, error: "That chain isn't one of yours." };
  await prisma.chainLink.update({
    where: { id: chainLinkId },
    data: {
      exchangeReadyConfirmedAt: ready ? new Date() : null,
      exchangeReadyConfirmedById: ready ? session.user.id : null,
    },
  });
  revalidatePath("/agent/chains");
  return { ok: true };
}

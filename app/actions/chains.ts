"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
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
}

"use server";

// Chase the neighbour agent above/below in the chain — server actions.
//
// Thin auth + multi-tenant guard (Law 7) around lib/services/neighbour-chase.ts,
// mirroring app/actions/onward.ts. Agent-side only; the recipient is a chain stub
// agent, never a client or solicitor (those use the ChaseDrawer, untouched here).

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  draftNeighbourChase,
  sendNeighbourChase,
  type NeighbourChaseDirection,
  type DraftNeighbourResult,
  type SendNeighbourResult,
} from "@/lib/services/neighbour-chase";

// Ownership gate. Throws if the transaction is out of the caller's scope.
async function requireTxInScope(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return { session };
}

export async function draftNeighbourChaseAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  tone: string;
}): Promise<DraftNeighbourResult> {
  await requireTxInScope(input.transactionId);
  return draftNeighbourChase(input.transactionId, input.direction, input.tone);
}

export async function sendNeighbourChaseAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  body: string;
}): Promise<SendNeighbourResult> {
  const { session } = await requireTxInScope(input.transactionId);
  return sendNeighbourChase({
    transactionId: input.transactionId,
    direction: input.direction,
    subject: input.subject,
    body: input.body,
    userId: session.user.id,
  });
}

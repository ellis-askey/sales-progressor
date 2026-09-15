"use server";

// Chase the neighbour agent above/below in the chain — server actions.
//
// Thin auth + multi-tenant guard (Law 7) around lib/services/neighbour-chase.ts,
// mirroring app/actions/onward.ts. Agent-side only; the recipient is a chain stub
// agent, never a client or solicitor (those use the ChaseDrawer, untouched here).

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { extractFirstName } from "@/lib/contacts/displayName";
import {
  draftNeighbourChase,
  sendNeighbourChase,
  logNeighbourChaseHandoff,
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
  const { session } = await requireTxInScope(input.transactionId);
  const senderFirstName = session.user.name ? extractFirstName(session.user.name) : "the team";
  return draftNeighbourChase(input.transactionId, input.direction, input.tone, senderFirstName);
}

export async function sendNeighbourChaseAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  force?: boolean;
}): Promise<SendNeighbourResult> {
  const { session } = await requireTxInScope(input.transactionId);
  return sendNeighbourChase({
    transactionId: input.transactionId,
    direction: input.direction,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    force: input.force,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      agencyId: session.user.agencyId,
    },
  });
}

// "Open in my email" — record the chase (logged, not app-sent) and hand back the
// recipient so the drawer can open the agent's own mail client via mailto.
export async function openNeighbourChaseInEmailAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  bodyText: string;
  force?: boolean;
}): Promise<SendNeighbourResult> {
  const { session } = await requireTxInScope(input.transactionId);
  return logNeighbourChaseHandoff({
    transactionId: input.transactionId,
    direction: input.direction,
    subject: input.subject,
    bodyText: input.bodyText,
    force: input.force,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      agencyId: session.user.agencyId,
    },
  });
}

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
  setNeighbourAgent,
  getNeighbourChaseContext,
  type NeighbourChaseDirection,
  type DraftNeighbourResult,
  type SendNeighbourResult,
  type SetNeighbourAgentResult,
  type NeighbourContextResult,
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

// Load the chase context (recipient, next step, cc option) without writing the
// AI draft — so the drawer can render on open and only generate on click.
export async function getNeighbourChaseContextAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  stepName?: string | null;
}): Promise<NeighbourContextResult> {
  await requireTxInScope(input.transactionId);
  return getNeighbourChaseContext(input.transactionId, input.direction, input.stepName);
}

// Save the neighbour agent's name + email onto the chain stub above/below, so
// the chase can go out and we remember them. Used by the drawer's inline "add
// the agent's details" entry when we don't have their email yet.
export async function setNeighbourAgentAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  name: string;
  email: string;
}): Promise<SetNeighbourAgentResult> {
  await requireTxInScope(input.transactionId);
  return setNeighbourAgent(input.transactionId, input.direction, input.name, input.email);
}

export async function draftNeighbourChaseAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  tone: string;
  // Optional: chase about a specific far-side step (per-step chase).
  stepName?: string | null;
}): Promise<DraftNeighbourResult> {
  const { session } = await requireTxInScope(input.transactionId);
  const senderFirstName = session.user.name ? extractFirstName(session.user.name) : "the team";
  return draftNeighbourChase(input.transactionId, input.direction, input.tone, senderFirstName, input.stepName);
}

export async function sendNeighbourChaseAction(input: {
  transactionId: string;
  direction: NeighbourChaseDirection;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  force?: boolean;
  // Opt-in CC of our own client (seller/buyer). Resolved server-side.
  includeCc?: boolean;
}): Promise<SendNeighbourResult> {
  const { session } = await requireTxInScope(input.transactionId);
  return sendNeighbourChase({
    transactionId: input.transactionId,
    direction: input.direction,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    force: input.force,
    includeCc: input.includeCc,
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

"use server";

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere, scopeTransactionWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  canEditNodeIntel,
  noteSideKey,
  agencySideKey,
  type IntelViewer,
  type ChainNodeOwnership,
  type ChainNodeIntelInput,
} from "@/lib/chain/intel";
import { CHECK_IN_STEPS, CHECK_IN_STEP_KEYS, checkInStepLabel, checkInConfirmationLine } from "@/lib/chain/check-in-steps";

// Shared guard: load the link's ownership facts and assert the caller may edit
// this node (canEditNodeIntel). Own-side only — never another agency, never the
// client. Returns the link's minimal shape for follow-on writes.
async function requireChainNodeEdit(
  session: Awaited<ReturnType<typeof requireSession>>,
  linkId: string,
) {
  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      createdByUserId: true,
      transactionId: true,
      createdBy: { select: { agencyId: true } },
      transaction: {
        select: { id: true, agencyId: true, assignedUserId: true, agentUserId: true, progressionBusinessId: true },
      },
    },
  });
  if (!link) throw new Error("Chain link not found");

  const scope = getAccessScope(session);
  const viewer: IntelViewer = {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    scope,
  };
  const ownership: ChainNodeOwnership = {
    transactionId: link.transactionId,
    linkCreatedByUserId: link.createdByUserId,
    linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
    txAgencyId: link.transaction?.agencyId ?? null,
    txAssignedUserId: link.transaction?.assignedUserId ?? null,
    txAgentUserId: link.transaction?.agentUserId ?? null,
    txProgressionBusinessId: link.transaction?.progressionBusinessId ?? null,
  };
  if (!canEditNodeIntel(viewer, ownership)) {
    throw new Error("You don't have permission to edit this chain node.");
  }
  return link;
}

// Save the private chain-node intel on a single ChainLink. Guarded by
// canEditNodeIntel (lib/chain/intel.ts) — the owning agent / assigned negotiator /
// director / internal team on a claimed node, or the stub originator / internal
// team on an unclaimed one. Every field is own-side private; nothing here is ever
// exposed to another agency or the client.
export async function saveChainIntelAction(linkId: string, input: ChainNodeIntelInput) {
  const session = await requireSession();
  const link = await requireChainNodeEdit(session, linkId);

  const trimOrNull = (s: string | null | undefined): string | null => {
    const t = (s ?? "").trim();
    return t.length ? t : null;
  };

  await prisma.chainLink.update({
    where: { id: linkId },
    data: {
      breakChainStance: input.breakChainStance,
      breakChainConditions: trimOrNull(input.breakChainConditions),
      expectedTimescale: trimOrNull(input.expectedTimescale),
      // chainNotes is no longer edited here (b1ey9l) — the chase log replaces it.
      // lastChainCheckAt is repurposed as the "Last updated" stamp for the chain
      // details: set to now on every save (the manual date picker is retired,
      // and chase-log entries carry their own dates — they don't touch this).
      lastChainCheckAt: new Date(),
    },
  });

  // Track the change on the file's internal timeline (claimed nodes only).
  // internal_note is never client-visible.
  if (link.transactionId) {
    await prisma.outboundMessage.create({
      data: {
        transactionId: link.transactionId,
        type: "internal_note",
        contactIds: [],
        content: `${session.user.name} updated the chain details for this file.`,
        createdById: session.user.id,
      },
    });
  }
}

// Add a dated chase-log entry to a chain node (b1ey9l). Same own-side guard as
// intel. Adding an entry counts as a chain check, so we stamp lastChainCheckAt.
// Returns the created entry (ISO date) so the drawer can show it immediately.
export async function addChainEntryAction(
  linkId: string,
  body: string,
  // The file the user is working on (the file whose chain is open). The entry's
  // Activity-tab mirror lands HERE — on your own file — not on the node's own
  // file (which could be another agency) and never in the shared chain feed.
  contextTransactionId?: string,
): Promise<{ id: string; body: string; authorName: string | null; createdAt: string }> {
  const session = await requireSession();

  // Access: you can log on a node you OWN (own-side), or on a NEIGHBOUR node in a
  // chain you're part of. Either way the entry is tagged to your side and stays
  // private to you — the neighbour never sees it, you never see theirs (#chain-checkins).
  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true, chainId: true, transactionId: true, createdByUserId: true,
      createdBy: { select: { agencyId: true } },
      transaction: { select: { agencyId: true, assignedUserId: true, agentUserId: true, progressionBusinessId: true } },
    },
  });
  if (!link) throw new Error("Chain link not found");

  const scope = getAccessScope(session);
  const viewer: IntelViewer = { userId: session.user.id, role: session.user.role, agencyId: session.user.agencyId ?? null, businessId: session.user.progressionBusinessId ?? null, scope };
  const ownSide = canEditNodeIntel(viewer, {
    transactionId: link.transactionId,
    linkCreatedByUserId: link.createdByUserId,
    linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
    txAgencyId: link.transaction?.agencyId ?? null,
    txAssignedUserId: link.transaction?.assignedUserId ?? null,
    txAgentUserId: link.transaction?.agentUserId ?? null,
    txProgressionBusinessId: link.transaction?.progressionBusinessId ?? null,
  });
  if (!ownSide) {
    const inChain = await prisma.propertyTransaction.findFirst({
      where: { AND: [scopeTransactionWhere(scope), { chainLink: { chainId: link.chainId } }] },
      select: { id: true },
    });
    if (!inChain) throw new Error("You don't have permission to log on this chain node.");
  }

  const text = body.trim();
  if (!text) throw new Error("Entry can't be empty.");
  if (text.length > 4000) throw new Error("That entry is too long.");

  // The file whose chain is open (contextTransactionId) is the note's TEAM
  // context: its owning agency is the side key, so the agency and its progressor
  // share one log on an outsourced file. Access-checked, so a caller can't claim a
  // context file they don't own.
  let contextTx: { id: string; agencyId: string } | null = null;
  if (contextTransactionId) {
    contextTx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, contextTransactionId),
      select: { id: true, agencyId: true },
    });
  }
  // Side key: the context file's agency; else (own-side log straight on a node we
  // own) that node's agency; else the author's identity as a last resort.
  const sideKey = contextTx
    ? agencySideKey(contextTx.agencyId)
    : ownSide && link.transaction?.agencyId
      ? agencySideKey(link.transaction.agencyId)
      : noteSideKey(viewer);

  const entry = await prisma.chainLinkEntry.create({
    data: {
      chainLinkId: linkId,
      body: text,
      authorId: session.user.id,
      authorName: session.user.name ?? null,
      authorSideKey: sideKey,
      authorAgencyId: session.user.agencyId ?? null,
      authorBusinessId: session.user.progressionBusinessId ?? null,
    },
    select: { id: true, body: true, authorName: true, createdAt: true },
  });

  // Mirror onto the working file's Activity tab (own-side, never client-visible).
  // Prefer the access-checked context file; fall back to the node's own file only
  // when WE own it — never write our note onto a neighbour's file.
  let activityTxId: string | null = contextTx?.id ?? null;
  if (!activityTxId && ownSide) activityTxId = link.transactionId;

  if (activityTxId) {
    const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
    await prisma.outboundMessage.create({
      data: {
        transactionId: activityTxId,
        type: "internal_note",
        contactIds: [],
        content: `${session.user.name} logged a chain update: "${preview}"`,
        createdById: session.user.id,
      },
    });
  }

  return { id: entry.id, body: entry.body, authorName: entry.authorName, createdAt: entry.createdAt.toISOString() };
}

// Toggle a "Confirm progress" step on a chain check-in node (critique #235).
// Same access + side-key model as addChainEntryAction: you can mark steps on a
// node you own or a neighbour node in a chain you're part of, and the marks are
// private to your side. Marking also writes a dated chase-log entry (so the
// steps and the notes stay one record); unmarking just removes the mark.
// When every step is marked, the link is flagged ready to exchange
// (exchangeReadyConfirmedAt — the field the push-to-exchange surface reads).
export async function toggleChainStepAction(
  linkId: string,
  stepKey: string,
  done: boolean,
  contextTransactionId?: string,
): Promise<{
  steps: string[]; // our side's marked step keys after the toggle
  entry: { at: string; body: string } | null; // the logged line (mark only)
}> {
  const session = await requireSession();
  if (!CHECK_IN_STEP_KEYS.has(stepKey)) throw new Error("Unknown step.");

  // Access: own-side node, or a neighbour node in a chain we're part of —
  // identical to addChainEntryAction (#chain-checkins).
  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true, chainId: true, transactionId: true, createdByUserId: true,
      exchangeReadyConfirmedAt: true,
      // The node's agency — "received confirmation from {agency}" (#286).
      stubAgencyName: true,
      claimedBy: { select: { firmName: true } },
      createdBy: { select: { agencyId: true } },
      transaction: { select: { agencyId: true, assignedUserId: true, agentUserId: true, progressionBusinessId: true } },
    },
  });
  if (!link) throw new Error("Chain link not found");

  const scope = getAccessScope(session);
  const viewer: IntelViewer = { userId: session.user.id, role: session.user.role, agencyId: session.user.agencyId ?? null, businessId: session.user.progressionBusinessId ?? null, scope };
  const ownSide = canEditNodeIntel(viewer, {
    transactionId: link.transactionId,
    linkCreatedByUserId: link.createdByUserId,
    linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
    txAgencyId: link.transaction?.agencyId ?? null,
    txAssignedUserId: link.transaction?.assignedUserId ?? null,
    txAgentUserId: link.transaction?.agentUserId ?? null,
    txProgressionBusinessId: link.transaction?.progressionBusinessId ?? null,
  });
  if (!ownSide) {
    const inChain = await prisma.propertyTransaction.findFirst({
      where: { AND: [scopeTransactionWhere(scope), { chainLink: { chainId: link.chainId } }] },
      select: { id: true },
    });
    if (!inChain) throw new Error("You don't have permission to update this chain node.");
  }

  // Side key resolution — identical to addChainEntryAction, so marks and log
  // entries always live under the same team scope.
  let contextTx: { id: string; agencyId: string } | null = null;
  if (contextTransactionId) {
    contextTx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, contextTransactionId),
      select: { id: true, agencyId: true },
    });
  }
  const sideKey = contextTx
    ? agencySideKey(contextTx.agencyId)
    : ownSide && link.transaction?.agencyId
      ? agencySideKey(link.transaction.agencyId)
      : noteSideKey(viewer);

  let entry: { at: string; body: string } | null = null;
  if (done) {
    await prisma.chainNodeStepMark.upsert({
      where: { chainLinkId_sideKey_stepKey: { chainLinkId: linkId, sideKey, stepKey } },
      create: { chainLinkId: linkId, sideKey, stepKey, markedById: session.user.id, markedByName: session.user.name ?? null },
      update: {},
    });
    // The mark doubles as a dated check-in line, so the row's "Last update"
    // and history reflect it without a separate note. Baked at confirm-time with
    // the confirmer + the node's agency: "{who} received confirmation from
    // {agency} that {clause}." (#286).
    const agencyName = link.claimedBy?.firmName ?? link.stubAgencyName ?? null;
    const created = await prisma.chainLinkEntry.create({
      data: {
        chainLinkId: linkId,
        body: checkInConfirmationLine(stepKey, session.user.name ?? "Your team", agencyName),
        authorId: session.user.id,
        authorName: session.user.name ?? null,
        authorSideKey: sideKey,
        authorAgencyId: session.user.agencyId ?? null,
        authorBusinessId: session.user.progressionBusinessId ?? null,
      },
      select: { body: true, createdAt: true },
    });
    entry = { at: created.createdAt.toISOString(), body: created.body };
  } else {
    await prisma.chainNodeStepMark.deleteMany({
      where: { chainLinkId: linkId, sideKey, stepKey },
    });
  }

  const marks = await prisma.chainNodeStepMark.findMany({
    where: { chainLinkId: linkId, sideKey },
    select: { stepKey: true },
  });
  const steps = marks.map((m) => m.stepKey);

  // Every step in (including both signed-and-returned finales) = this node is
  // ready to exchange. Stamp the existing agent-maintained flag the
  // push-to-exchange surface reads. Set once; never cleared from here, so a
  // mis-tap undo doesn't silently retract a readiness the team may have
  // already acted on — the exchange surface owns un-confirming.
  if (steps.length === CHECK_IN_STEPS.length && !link.exchangeReadyConfirmedAt) {
    await prisma.chainLink.update({
      where: { id: linkId },
      data: { exchangeReadyConfirmedAt: new Date(), exchangeReadyConfirmedById: session.user.id },
    });
  }

  return { steps, entry };
}

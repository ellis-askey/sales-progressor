"use server";

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  canEditNodeIntel,
  type IntelViewer,
  type ChainNodeOwnership,
  type ChainNodeIntelInput,
} from "@/lib/chain/intel";

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
        select: { id: true, agencyId: true, assignedUserId: true, agentUserId: true },
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

  const lastChainCheckAt = input.markCheckedNow
    ? new Date()
    : input.lastChainCheckAt
      ? new Date(input.lastChainCheckAt)
      : null;

  await prisma.chainLink.update({
    where: { id: linkId },
    data: {
      breakChainStance: input.breakChainStance,
      breakChainConditions: trimOrNull(input.breakChainConditions),
      expectedTimescale: trimOrNull(input.expectedTimescale),
      // chainNotes is no longer edited here (b1ey9l) — the chase log (ChainLinkEntry)
      // replaces it. Left untouched so any legacy note survives until the one-off
      // migration folds it into entries.
      lastChainCheckAt,
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
  const link = await requireChainNodeEdit(session, linkId);

  const text = body.trim();
  if (!text) throw new Error("Entry can't be empty.");
  if (text.length > 4000) throw new Error("That entry is too long.");

  const entry = await prisma.chainLinkEntry.create({
    data: {
      chainLinkId: linkId,
      body: text,
      authorId: session.user.id,
      authorName: session.user.name ?? null,
    },
    select: { id: true, body: true, authorName: true, createdAt: true },
  });

  // Logging an update IS a chain check — keep the "chased X ago" hint fresh.
  await prisma.chainLink.update({ where: { id: linkId }, data: { lastChainCheckAt: new Date() } });

  // Mirror onto the working file's Activity tab (own-side, never client-visible).
  // Prefer the context file the user is viewing (access-checked); fall back to
  // the node's own claimed file only when no context is supplied.
  let activityTxId: string | null = null;
  if (contextTransactionId) {
    const scope = getAccessScope(session);
    const ctx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, contextTransactionId),
      select: { id: true },
    });
    if (ctx) activityTxId = ctx.id;
  }
  if (!activityTxId) activityTxId = link.transactionId;

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

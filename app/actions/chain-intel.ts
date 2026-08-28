"use server";

import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  canEditNodeIntel,
  type IntelViewer,
  type ChainNodeOwnership,
  type ChainNodeIntelInput,
} from "@/lib/chain/intel";

// Save the private chain-node intel on a single ChainLink. Guarded by
// canEditNodeIntel (lib/chain/intel.ts) — the owning agent / assigned negotiator /
// director / internal team on a claimed node, or the stub originator / internal
// team on an unclaimed one. Every field is own-side private; nothing here is ever
// exposed to another agency or the client.
export async function saveChainIntelAction(linkId: string, input: ChainNodeIntelInput) {
  const session = await requireSession();

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
      chainNotes: trimOrNull(input.chainNotes),
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

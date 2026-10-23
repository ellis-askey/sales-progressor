// lib/chain/stub-permissions.ts
// Server-side gate for managing an UNCLAIMED chain stub: editing it, removing it,
// sending its invite, minting/revoking its share link, or setting its photo.
//
// Single rule for all of those actions, so the API routes can't drift apart the
// way they did before (edit/remove were agency-aware via lib/chain/intel.ts,
// while invite/share/photo were originator-only). The rule reuses the intel
// ownership model: internal team, the stub's creator, or a director in the
// creating agency. Claimed links are real files, not stubs, so this is always
// false for them.
//
// Server-only (imports getAccessScope). Do not import into client components.

import { type Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/security/access-scope";
import {
  canEditNodeIntel,
  viewerProgressesChainFromTxs,
  type IntelViewer,
  type ChainNodeOwnership,
  type ChainEditContext,
} from "@/lib/chain/intel";

// The link fields a stub-management decision needs. Routes select these (plus the
// creating agency and the claimed file's agency/owners) and map them here.
export type StubLinkRow = {
  transactionId: string | null;
  createdByUserId: string | null;
  createdBy: { agencyId: string | null } | null;
  transaction: { agencyId: string | null; assignedUserId: string | null; agentUserId: string | null; progressionBusinessId: string | null } | null;
};

export function ownershipFromLinkRow(link: StubLinkRow): ChainNodeOwnership {
  return {
    transactionId: link.transactionId,
    linkCreatedByUserId: link.createdByUserId,
    linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
    txAgencyId: link.transaction?.agencyId ?? null,
    txAssignedUserId: link.transaction?.assignedUserId ?? null,
    txAgentUserId: link.transaction?.agentUserId ?? null,
    txProgressionBusinessId: link.transaction?.progressionBusinessId ?? null,
  };
}

function viewerFromSession(session: Session): IntelViewer {
  return {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    scope: getAccessScope(session),
  };
}

export function canManageStub(
  session: Session | null,
  ownership: ChainNodeOwnership,
  ctx?: ChainEditContext,
): boolean {
  if (!session?.user) return false;
  if (ownership.transactionId !== null) return false; // claimed = a real file, not a stub
  return canEditNodeIntel(viewerFromSession(session), ownership, ctx);
}

// Chain-level edit context for the mutation routes. An outsourced progression
// business may manage any placeholder in a chain where it runs a claimed sale,
// even one another party added (critique #300). Only the "business" scope needs
// this lookup — every other editor is decided by node-level facts alone — so we
// skip the query otherwise and keep the UI flag (chains.ts) and the server guard
// reading the same rule.
export async function loadChainEditContext(
  session: Session | null,
  chainId: string,
): Promise<ChainEditContext> {
  if (!session?.user) return {};
  const viewer = viewerFromSession(session);
  if (viewer.scope.kind !== "business") return {};
  const links = await prisma.chainLink.findMany({
    where: { chainId },
    select: { transaction: { select: { agencyId: true, progressionBusinessId: true } } },
  });
  const claimedTxs = links
    .map((l) => l.transaction)
    .filter((t): t is NonNullable<typeof t> => t != null);
  return { viewerProgressesChain: viewerProgressesChainFromTxs(viewer, claimedTxs) };
}

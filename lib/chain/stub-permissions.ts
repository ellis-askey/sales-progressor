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
import { getAccessScope } from "@/lib/security/access-scope";
import { canEditNodeIntel, type IntelViewer, type ChainNodeOwnership } from "@/lib/chain/intel";

// The link fields a stub-management decision needs. Routes select these (plus the
// creating agency and the claimed file's agency/owners) and map them here.
export type StubLinkRow = {
  transactionId: string | null;
  createdByUserId: string | null;
  createdBy: { agencyId: string | null } | null;
  transaction: { agencyId: string | null; assignedUserId: string | null; agentUserId: string | null } | null;
};

export function ownershipFromLinkRow(link: StubLinkRow): ChainNodeOwnership {
  return {
    transactionId: link.transactionId,
    linkCreatedByUserId: link.createdByUserId,
    linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
    txAgencyId: link.transaction?.agencyId ?? null,
    txAssignedUserId: link.transaction?.assignedUserId ?? null,
    txAgentUserId: link.transaction?.agentUserId ?? null,
  };
}

export function canManageStub(session: Session | null, ownership: ChainNodeOwnership): boolean {
  if (!session?.user) return false;
  if (ownership.transactionId !== null) return false; // claimed = a real file, not a stub
  const viewer: IntelViewer = {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    scope: getAccessScope(session),
  };
  return canEditNodeIntel(viewer, ownership);
}

// lib/chain/intel.ts
// Who may SEE and who may EDIT a chain node's private "intel" (break-chain
// stance / conditions, expected timescale, chain notes, last-checked date).
//
// The trust boundary, agreed with Ellis 2026-08-28 (docs/active/chain-overhaul/
// 00-spec.md, Decisions 2/3/6):
//   - VISIBLE to our internal team + the agency that OWNS that node's file only.
//     Never another agency in the chain, never the client.
//   - EDITABLE by the file's owning agent, the assigned negotiator (overseer),
//     the agency director, and internal team handling the file. On an unclaimed
//     stub, only whoever added it (or internal team).
//
// Pure functions, no server-only imports, so this module is safe to import from
// client components for the shared input type.

import type { AccessScope } from "@/lib/security/access-scope";
import { isInternalStaff } from "@/lib/chain/permissions";

export type IntelViewer = {
  userId: string;
  role: string | null;
  agencyId: string | null;
  scope: AccessScope;
};

// The ownership facts a permission decision needs, pulled from the link + its
// claimed transaction (null transaction = unclaimed stub).
export type ChainNodeOwnership = {
  transactionId: string | null;
  linkCreatedByUserId: string | null;
  // Agency of whoever ADDED this link (the stub creator). Used to scope an
  // unclaimed placeholder's intel to that agency — never the chain's agency,
  // which would leak to a different agency that added its own stubs.
  linkCreatedByAgencyId: string | null;
  txAgencyId: string | null;
  txAssignedUserId: string | null;
  txAgentUserId: string | null;
};

// The shape a client sends when saving intel (dates as ISO strings). Kept here so
// both the server action and the client form import one definition.
export type ChainNodeIntelInput = {
  breakChainStance: "PREPARED" | "IF_REQUIRED" | "UNWILLING" | null;
  breakChainConditions: string | null;
  expectedTimescale: string | null;
  chainNotes: string | null;
  lastChainCheckAt: string | null;
  // Convenience: set true to stamp last-checked to now regardless of the date field.
  markCheckedNow?: boolean;
};

export function canViewNodeIntel(v: IntelViewer, o: ChainNodeOwnership): boolean {
  // Internal staff see the chains they can already access.
  if (isInternalStaff(v.role)) return true;
  if (o.transactionId === null) {
    // Unclaimed placeholder: the whole agency that ADDED it (a director /
    // colleague), not just the person who typed it. Never another agency.
    return (
      o.linkCreatedByUserId === v.userId ||
      (!!o.linkCreatedByAgencyId && o.linkCreatedByAgencyId === v.agencyId)
    );
  }
  // Claimed node: anyone in the owning agency.
  return !!o.txAgencyId && o.txAgencyId === v.agencyId;
}

export function canEditNodeIntel(v: IntelViewer, o: ChainNodeOwnership): boolean {
  if (o.transactionId === null) {
    // Unclaimed placeholder: internal team, whoever added it, or a director in
    // the same agency (mirrors the claimed-node rule: creator / director / us).
    if (isInternalStaff(v.role)) return true;
    if (o.linkCreatedByUserId === v.userId) return true;
    return v.role === "director" && !!o.linkCreatedByAgencyId && o.linkCreatedByAgencyId === v.agencyId;
  }
  // Claimed node.
  if (v.scope.kind === "all") return true; // admin / superadmin / hybrid
  if (v.scope.kind === "assigned") {
    // sales_progressor: only on the file assigned to them.
    return o.txAssignedUserId === v.scope.userId;
  }
  // Agency scope: director edits any file in the agency; a negotiator only if
  // they are the assigned overseer or the owning agent.
  if (!o.txAgencyId || o.txAgencyId !== v.agencyId) return false;
  if (v.role === "director") return true;
  return o.txAssignedUserId === v.userId || o.txAgentUserId === v.userId;
}

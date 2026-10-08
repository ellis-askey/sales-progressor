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

export type IntelViewer = {
  userId: string;
  role: string | null;
  agencyId: string | null;
  // The viewer's progression business (internal/business users). With agencyId
  // this gives the viewer's "side key" for the private chase-log filter (#chain-checkins).
  businessId?: string | null;
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
  // The node's progression business (null = TSP / agency file). A TSP "all" viewer
  // may VIEW any node (read-only across a shared chain they coordinate) but may NOT
  // EDIT an external progression business's node — that stays theirs to change.
  txProgressionBusinessId: string | null;
};

// The shape a client sends when saving intel (dates as ISO strings). Kept here so
// both the server action and the client form import one definition.
export type ChainNodeIntelInput = {
  breakChainStance: "PREPARED" | "IF_REQUIRED" | "UNWILLING" | null;
  breakChainConditions: string | null;
  expectedTimescale: string | null;
  chainNotes: string | null;
};

// The "side" a chain-node chase-log note belongs to — the privacy scope for both
// the drawer chase log and the Check-ins tab. NON-NULL for everyone, so the
// filter never collapses to "show nothing":
//   - an agency by its id        → `agency:<id>`
//   - a progression business      → `business:<id>`
//   - the internal TSP team (agencyId AND businessId both null) → `tsp-internal`,
//     one shared side so the whole internal team sees each other's working notes.
// Used symmetrically: tag the entry on write, match the viewer on read. (#chain-checkins)
export function noteSideKey(v: { agencyId: string | null; businessId?: string | null; scope: AccessScope }): string {
  if (v.agencyId) return `agency:${v.agencyId}`;
  if (v.businessId) return `business:${v.businessId}`;
  if (v.scope.kind === "business") return `business:${v.scope.businessId}`;
  return "tsp-internal";
}

export function canViewNodeIntel(v: IntelViewer, o: ChainNodeOwnership): boolean {
  // TSP internal team (platform-wide "all" or "assigned" scope) see the intel on
  // any chain they can already access. Distinguished by SCOPE, not role, so an
  // external progression-business member (also role sales_progressor) is NOT
  // treated as TSP internal.
  if (v.scope.kind === "all" || v.scope.kind === "assigned") return true;
  // External progression-business member: bounded to nodes they personally
  // progress (their own assigned file) or an unclaimed stub they created. Never
  // another agency's or another business's node. (Cross-member visibility within
  // a single business is a Phase 7 refinement.)
  if (v.scope.kind === "business") {
    if (o.transactionId === null) return o.linkCreatedByUserId === v.userId;
    return o.txAssignedUserId === v.userId;
  }
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
  // TSP internal team — by scope, not role (see canViewNodeIntel).
  const tspInternal = v.scope.kind === "all" || v.scope.kind === "assigned";
  if (o.transactionId === null) {
    // Unclaimed placeholder: TSP internal team, whoever added it, or a director
    // in the same agency (mirrors the claimed-node rule: creator / director / us).
    // An external business member: only a stub they created themselves.
    if (tspInternal) return true;
    if (o.linkCreatedByUserId === v.userId) return true;
    return v.role === "director" && !!o.linkCreatedByAgencyId && o.linkCreatedByAgencyId === v.agencyId;
  }
  // Claimed node.
  // TSP ("all") edits only its OWN nodes; an external business's node is read-only
  // to TSP (view stays open above). admin / superadmin / hybrid.
  if (v.scope.kind === "all") return o.txProgressionBusinessId == null;
  if (v.scope.kind === "assigned") {
    // sales_progressor: only on the file assigned to them.
    return o.txAssignedUserId === v.scope.userId;
  }
  if (v.scope.kind === "business") {
    // External progression-business member: only their own assigned file. Never
    // another agency's or another business's node.
    return o.txAssignedUserId === v.userId;
  }
  // Agency scope: director edits any file in the agency; a negotiator only if
  // they are the assigned overseer or the owning agent.
  if (!o.txAgencyId || o.txAgencyId !== v.agencyId) return false;
  if (v.role === "director") return true;
  return o.txAssignedUserId === v.userId || o.txAgentUserId === v.userId;
}

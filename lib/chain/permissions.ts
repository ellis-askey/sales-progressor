// lib/chain/permissions.ts
// Server-side permission helpers for chain operations.
// Every mutation API route calls these before acting.

type LinkPermissionData = {
  createdByUserId: string | null;
  claimedByUserId: string | null;
  transactionId: string | null;
  stubAgentEmail: string | null;
  inviteStatus: string;
};

type ChainLinkSummary = {
  claimedByUserId: string | null;
  createdByUserId: string | null;
};

function isOriginator(link: LinkPermissionData, userId: string): boolean {
  return link.createdByUserId === userId;
}

function isClaimer(link: LinkPermissionData, userId: string): boolean {
  return link.claimedByUserId === userId;
}

function isUnclaimed(link: LinkPermissionData): boolean {
  return link.transactionId === null;
}

// Internal staff (admin / superadmin / sales_progressor) progress files they
// don't originate — on an OUTSOURCED sale the agency agent creates the file and
// its chain on submission, so they're the chain originator and internal staff
// would otherwise be locked out of editing it. This mirrors the same exception
// canViewChain already grants (added 2026-07-14). Customer-agency roles
// (director / negotiator) fall through to the originator/claimer checks, so
// their edit logic is unchanged. Uses INTERNAL_ROLES_SEE_ALL_CHAINS (declared
// below — referenced at call time, so ordering is fine).
export function isInternalStaff(role?: string | null): boolean {
  return !!role && INTERNAL_ROLES_SEE_ALL_CHAINS.has(role);
}

// Edit stub data (address, agency, email, notes) — originator (or internal
// staff) only while unclaimed
export function canEditLink(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return (isInternalStaff(role) || isOriginator(link, userId)) && isUnclaimed(link);
}

// Send or resend an invite — originator/internal staff, unclaimed, must have email
export function canSendInvite(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return (
    (isInternalStaff(role) || isOriginator(link, userId)) &&
    isUnclaimed(link) &&
    !!link.stubAgentEmail
  );
}

// Delete (cancel) a link — originator/internal staff while unclaimed
export function canDeleteLink(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return (isInternalStaff(role) || isOriginator(link, userId)) && isUnclaimed(link);
}

// Add a node above this link:
//   - originator can add above if this link is at the top (checked by caller)
//   - claimed agent can add above their own claimed link
//   - internal staff progressing the file can add above (checked by caller)
export function canAddAbove(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return isInternalStaff(role) || isOriginator(link, userId) || isClaimer(link, userId);
}

// Add a node below this link:
//   - originator or claimer can add below if their link is at the bottom (checked by caller)
//   - internal staff progressing the file can add below (checked by caller)
export function canAddBelow(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return isInternalStaff(role) || isOriginator(link, userId) || isClaimer(link, userId);
}

// Internal staff roles that see every chain on every file they can access.
// Matches the wider access-scope model in lib/security/access-scope.ts: these
// roles have platform-wide (or assigned-file-wide) transaction visibility, so
// gating the chain drawer behind per-link membership would falsely hide chains
// they legitimately need to progress. Customer-agency roles (director /
// negotiator / viewer) still go through the participant check.
const INTERNAL_ROLES_SEE_ALL_CHAINS = new Set(["admin", "superadmin", "sales_progressor"]);

// View the full chain (address, agency, % progress on all nodes).
//
// Two paths through this check:
//   - Internal staff (admin / superadmin / sales_progressor) → always true.
//     They already see every transaction they touch; hiding the chain from
//     them was the source of the "No chain yet + Create" trap on Taylor's
//     83 Highfield Road file (2026-07-14).
//   - Everyone else → must be a participant (created or claimed at least one
//     link in this chain). Same rule as before this file was extended.
//
// The `role` argument is optional so existing test callers keep working — a
// missing role falls through to the participant check, which is the safest
// default. Production callers always pass session.user.role.
export function canViewChain(
  allLinks: ChainLinkSummary[],
  userId: string,
  role?: string | null,
): boolean {
  if (role && INTERNAL_ROLES_SEE_ALL_CHAINS.has(role)) return true;
  return allLinks.some(
    (l) => l.claimedByUserId === userId || l.createdByUserId === userId,
  );
}

// View stub private details (email, phone, notes) — originator/internal staff while unclaimed
export function canViewStubDetails(link: LinkPermissionData, userId: string, role?: string | null): boolean {
  return (isInternalStaff(role) || isOriginator(link, userId)) && isUnclaimed(link);
}

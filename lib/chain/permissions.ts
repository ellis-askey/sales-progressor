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

// Edit stub data (address, agency, email, notes) — originator only while unclaimed
export function canEditLink(link: LinkPermissionData, userId: string): boolean {
  return isOriginator(link, userId) && isUnclaimed(link);
}

// Send or resend an invite — originator only, unclaimed, must have email
export function canSendInvite(link: LinkPermissionData, userId: string): boolean {
  return (
    isOriginator(link, userId) &&
    isUnclaimed(link) &&
    !!link.stubAgentEmail
  );
}

// Delete (cancel) a link — originator only while unclaimed
export function canDeleteLink(link: LinkPermissionData, userId: string): boolean {
  return isOriginator(link, userId) && isUnclaimed(link);
}

// Add a node above this link:
//   - originator can add above if this link is at the top (checked by caller)
//   - claimed agent can add above their own claimed link
export function canAddAbove(link: LinkPermissionData, userId: string): boolean {
  return isOriginator(link, userId) || isClaimer(link, userId);
}

// Add a node below this link:
//   - originator or claimer can add below if their link is at the bottom (checked by caller)
export function canAddBelow(link: LinkPermissionData, userId: string): boolean {
  return isOriginator(link, userId) || isClaimer(link, userId);
}

// View the full chain (address, agency, % progress on all nodes)
// Requires the user to be a participant — i.e. they have at least one claimed link
// OR they are the originator of any link in the chain.
export function canViewChain(
  allLinks: ChainLinkSummary[],
  userId: string,
): boolean {
  return allLinks.some(
    (l) => l.claimedByUserId === userId || l.createdByUserId === userId,
  );
}

// View stub private details (email, phone, notes) — originator only while unclaimed
export function canViewStubDetails(link: LinkPermissionData, userId: string): boolean {
  return isOriginator(link, userId) && isUnclaimed(link);
}

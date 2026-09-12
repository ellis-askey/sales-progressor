// Shared dead-round guard for portal WRITE actions (audit P1-4, 2026-09-12).
//
// Relist deliberately does NOT rotate a superseded (fallen-through) buyer's
// portal token — the page render shows them a DeadRoundNotice instead of a 404
// (see lib/services/portal.ts resolvePortalRoundContext). But the server actions
// behind the portal are independently callable with that still-valid token, so a
// superseded buyer could mutate the CURRENT buyer's live round (costs, dates,
// move info, messages, survey bookings, chase notes).
//
// This guard is the single source of the round check the read path already
// enforces. A purchaser whose buyerRoundId no longer matches the file's active
// round throws PORTAL_DEAD_ROUND_ERROR. Vendors (file-level, no round) and the
// live buyer are a no-op. An invalid/unknown token is also a no-op here — each
// caller keeps its own invalid-token handling.

import { prisma } from "@/lib/prisma";

export const PORTAL_DEAD_ROUND_ERROR = "PORTAL_DEAD_ROUND";

export async function assertLivePortalRound(token: string): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  // Vendors are file-level; a buyer with no round, or an unknown token, can't be
  // a superseded round — leave the caller's own handling to deal with those.
  if (!contact || contact.roleType !== "purchaser" || contact.buyerRoundId == null) return;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { activeBuyerRoundId: true },
  });
  if (tx && contact.buyerRoundId !== tx.activeBuyerRoundId) {
    throw new Error(PORTAL_DEAD_ROUND_ERROR);
  }
}

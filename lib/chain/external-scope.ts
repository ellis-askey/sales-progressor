import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import type { Session } from "next-auth";

/**
 * Chain by-id access for an EXTERNAL progression-business member (audit B1).
 *
 * External business owners/members log in with role `sales_progressor` — the SAME
 * role as TSP's own internal team — so the chain permission helpers' "internal staff
 * see/manage every chain" shortcut (isInternalStaff / INTERNAL_ROLES_SEE_ALL_CHAINS
 * in lib/chain/permissions.ts) silently grants them platform-wide chain powers. The
 * by-chain-id routes load the chain purely by id with no ownership filter, so without
 * this an external member could view / edit / delete a chain belonging to other
 * companies (chains span multiple tenants).
 *
 * This resolves whether the caller is an external business member and, if so, scopes
 * them to their own book — exactly like a customer agency:
 *   - returns null  → the caller is NOT an external member (TSP admin/superadmin, a
 *     TSP progressor, or an agency user). Routes keep their normal role/agency checks.
 *   - returns { participates, isCreator } → an external member. `participates` is true
 *     only when one of THEIR OWN sales is a link in this chain; `isCreator` only when
 *     they created the chain. Routes must gate on these instead of the internal-staff
 *     shortcut (view/manage → participates; delete → participates AND isCreator).
 */
export async function externalMemberChainAccess(
  session: Session,
  chainId: string,
): Promise<{ participates: boolean; isCreator: boolean } | null> {
  const member = await resolveBusinessMember(session);
  if (!member) return null; // TSP staff / agency users → caller uses normal checks

  const [participatingLinks, chain] = await Promise.all([
    prisma.chainLink.count({
      where: { chainId, transaction: { progressionBusinessId: member.businessId } },
    }),
    prisma.propertyChain.findUnique({ where: { id: chainId }, select: { createdByUserId: true } }),
  ]);

  return {
    participates: participatingLinks > 0,
    isCreator: !!chain && chain.createdByUserId === session.user.id,
  };
}

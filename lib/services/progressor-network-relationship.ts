// Agency-side relationship data for the Progressor Network "My progressors" view.
//
// Two reads, both scoped to the VIEWING agency's own transactions (agencyId comes
// from the session, never the client): per-connected-business counts of the sales
// this agency has handed to each progressor, and the agency's active self-managed
// sales that are eligible to hand over ("Assign a sale"). Readiness (solicitors
// set, a fee on the link) is enforced by switchServiceTypeAction on submit — this
// only lists candidates, it does not pre-judge them.

import { prisma } from "@/lib/prisma";

export type ProgressorRelationshipStats = { activeSales: number; exchanged: number };

/** Per-business counts of the files this agency has with each connected progressor. */
export async function getAgencyProgressorRelationshipStats(
  agencyId: string,
  businessIds: string[],
): Promise<Map<string, ProgressorRelationshipStats>> {
  const map = new Map<string, ProgressorRelationshipStats>();
  for (const id of businessIds) map.set(id, { activeSales: 0, exchanged: 0 });
  if (!agencyId || businessIds.length === 0) return map;

  const rows = await prisma.propertyTransaction.findMany({
    where: { agencyId, progressionBusinessId: { in: businessIds }, isDemo: false },
    select: { progressionBusinessId: true, status: true, exchangedAt: true },
  });
  for (const r of rows) {
    if (!r.progressionBusinessId) continue;
    const s = map.get(r.progressionBusinessId);
    if (!s) continue;
    if (r.exchangedAt) s.exchanged += 1;
    else if (r.status === "active") s.activeSales += 1;
  }
  return map;
}

export type HandoverableSale = { id: string; address: string };

/**
 * The agency's active, self-managed sales not yet handed to any progression
 * business — the candidate list for "Assign a sale". Capped; the hand-over gate
 * (readiness + fee) runs server-side when one is chosen.
 */
export async function getHandoverableSales(agencyId: string): Promise<HandoverableSale[]> {
  if (!agencyId) return [];
  const rows = await prisma.propertyTransaction.findMany({
    where: { agencyId, serviceType: "self_managed", status: "active", progressionBusinessId: null, isDemo: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, propertyAddress: true },
    take: 200,
  });
  return rows.map((r) => ({ id: r.id, address: r.propertyAddress }));
}

// Read helpers for the "Connect your CRM" page (critique #289). Server-only.
// Counts are an anonymous aggregate (how many agencies want each CRM), so they
// are not tenant-scoped; the "which has THIS agency requested" read is scoped to
// the agency. Writes live in app/actions/crm-connect.ts.

import { prisma } from "@/lib/prisma";

// Distinct-agency demand per CRM key (one row per agency per CRM, so a plain
// count is the number of agencies).
export async function getCrmCounts(): Promise<Record<string, number>> {
  const groups = await prisma.crmConnectionRequest.groupBy({ by: ["crmKey"], _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.crmKey, g._count._all]));
}

// The CRM keys this agency has already asked for (drives the "Requested" state).
export async function getAgencyRequestedKeys(agencyId: string): Promise<string[]> {
  const rows = await prisma.crmConnectionRequest.findMany({ where: { agencyId }, select: { crmKey: true } });
  return rows.map((r) => r.crmKey);
}

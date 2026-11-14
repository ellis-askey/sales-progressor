// Command Centre data for CRM connection demand (critique #289). Superadmin
// context (commandDb). Feeds /command/crm-requests: the ranked demand league
// table + the recent request feed, so we can see which CRM to build first and
// follow up the agencies that asked.

import { commandDb } from "@/lib/command/prisma";
import { crmDisplayName } from "@/lib/crm/catalogue";

export type CrmDemandRow = { crmKey: string; crmName: string; total: number; newThisWeek: number };
export type CrmRequestRow = { id: string; crmKey: string; crmName: string; agencyName: string | null; requestedByName: string | null; createdAt: Date };

export async function getCrmDemand(): Promise<{ demand: CrmDemandRow[]; recent: CrmRequestRow[]; total: number }> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [groups, weekGroups, recent] = await Promise.all([
    commandDb.crmConnectionRequest.groupBy({ by: ["crmKey", "crmName"], _count: { _all: true } }),
    commandDb.crmConnectionRequest.groupBy({ by: ["crmKey"], where: { createdAt: { gte: weekAgo } }, _count: { _all: true } }),
    commandDb.crmConnectionRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, crmKey: true, crmName: true, agencyName: true, requestedByName: true, createdAt: true },
    }),
  ]);

  const weekByKey = new Map(weekGroups.map((g) => [g.crmKey, g._count._all]));
  // Merge by key (a free-text "other" CRM can arrive under one key with slightly
  // different typed names).
  const byKey = new Map<string, CrmDemandRow>();
  for (const g of groups) {
    const existing = byKey.get(g.crmKey);
    if (existing) existing.total += g._count._all;
    else byKey.set(g.crmKey, { crmKey: g.crmKey, crmName: crmDisplayName(g.crmKey, g.crmName), total: g._count._all, newThisWeek: weekByKey.get(g.crmKey) ?? 0 });
  }
  const demand = [...byKey.values()].sort((a, b) => b.total - a.total);
  const total = groups.reduce((n, g) => n + g._count._all, 0);
  return { demand, recent, total };
}

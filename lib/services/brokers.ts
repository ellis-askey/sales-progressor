import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { TransactionStatus } from "@prisma/client";

// Broker directory, mirror of lib/services/solicitors.ts. Brokers only ever
// attach on the purchaser side (mortgage files), so — unlike solicitors —
// there is a single slot per file and no vendor/purchaser split.

export type BrokerContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; isReferral: boolean }[];
};

export type BrokerFirmWithStats = {
  id: string;
  name: string;
  website: string | null;
  totalActiveFiles: number;
  referralActiveFiles: number;
  contacts: BrokerContactWithFiles[];
};

/** Returns broker firms scoped to the agent's visible active transactions. */
export async function getBrokerDirectoryForAgent(vis: AgentVisibility): Promise<BrokerFirmWithStats[]> {
  const activeStatuses = ["active", "on_hold"] as TransactionStatus[];

  const txFilter = vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName }, status: { in: activeStatuses } }
      : { agencyId: vis.agencyId, status: { in: activeStatuses } }
    : { agentUserId: vis.userId, status: { in: activeStatuses } };

  const transactions = await prisma.propertyTransaction.findMany({
    where: { ...txFilter, brokerFirmId: { not: null } },
    select: {
      id: true,
      propertyAddress: true,
      brokerFirmId: true,
      brokerContactId: true,
      purchaserBrokerReferral: true,
    },
  });

  const firmIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.brokerFirmId) firmIds.add(tx.brokerFirmId);
  }
  if (firmIds.size === 0) return [];

  const filesByFirm = new Map<string, Set<string>>();
  const referralByFirm = new Map<string, Set<string>>();
  const filesByContact = new Map<string, { id: string; propertyAddress: string; isReferral: boolean }[]>();

  for (const tx of transactions) {
    if (!tx.brokerFirmId) continue;
    if (!filesByFirm.has(tx.brokerFirmId)) filesByFirm.set(tx.brokerFirmId, new Set());
    filesByFirm.get(tx.brokerFirmId)!.add(tx.id);
    if (tx.purchaserBrokerReferral) {
      if (!referralByFirm.has(tx.brokerFirmId)) referralByFirm.set(tx.brokerFirmId, new Set());
      referralByFirm.get(tx.brokerFirmId)!.add(tx.id);
    }
    if (tx.brokerContactId) {
      if (!filesByContact.has(tx.brokerContactId)) filesByContact.set(tx.brokerContactId, []);
      filesByContact.get(tx.brokerContactId)!.push({
        id: tx.id,
        propertyAddress: tx.propertyAddress,
        isReferral: tx.purchaserBrokerReferral,
      });
    }
  }

  const firms = await prisma.brokerFirm.findMany({
    where: { id: { in: [...firmIds] } },
    orderBy: { name: "asc" },
    include: { handlers: { orderBy: { name: "asc" } } },
  });

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    website: firm.website,
    totalActiveFiles: filesByFirm.get(firm.id)?.size ?? 0,
    referralActiveFiles: referralByFirm.get(firm.id)?.size ?? 0,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: filesByContact.get(h.id) ?? [],
    })),
  }));
}

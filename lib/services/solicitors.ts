import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { TransactionStatus } from "@prisma/client";

export type SolicitorContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role: "vendor" | "purchaser" }[];
};

export type SolicitorFirmWithStats = {
  id: string;
  name: string;
  totalActiveFiles: number;
  contacts: SolicitorContactWithFiles[];
};

/** Returns solicitor firms scoped to the agent's visible transactions. */
export async function getSolicitorDirectoryForAgent(vis: AgentVisibility): Promise<SolicitorFirmWithStats[]> {
  const activeStatuses = ["active", "on_hold"] as TransactionStatus[];

  const txFilter = vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName }, status: { in: activeStatuses } }
      : { agencyId: vis.agencyId, status: { in: activeStatuses } }
    : { agentUserId: vis.userId, status: { in: activeStatuses } };

  const transactions = await prisma.propertyTransaction.findMany({
    where: txFilter,
    select: {
      id: true,
      propertyAddress: true,
      vendorSolicitorFirmId: true,
      purchaserSolicitorFirmId: true,
      vendorSolicitorContactId: true,
      purchaserSolicitorContactId: true,
    },
  });

  const firmIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) firmIds.add(tx.vendorSolicitorFirmId);
    if (tx.purchaserSolicitorFirmId) firmIds.add(tx.purchaserSolicitorFirmId);
  }

  if (firmIds.size === 0) return [];

  // Build contact → files maps from scoped transactions
  const vendorByFirm = new Map<string, Set<string>>();
  const purchaserByFirm = new Map<string, Set<string>>();
  const filesByContact = new Map<string, { id: string; propertyAddress: string; role: "vendor" | "purchaser" }[]>();

  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) {
      if (!vendorByFirm.has(tx.vendorSolicitorFirmId)) vendorByFirm.set(tx.vendorSolicitorFirmId, new Set());
      vendorByFirm.get(tx.vendorSolicitorFirmId)!.add(tx.id);
    }
    if (tx.purchaserSolicitorFirmId) {
      if (!purchaserByFirm.has(tx.purchaserSolicitorFirmId)) purchaserByFirm.set(tx.purchaserSolicitorFirmId, new Set());
      purchaserByFirm.get(tx.purchaserSolicitorFirmId)!.add(tx.id);
    }
    if (tx.vendorSolicitorContactId) {
      if (!filesByContact.has(tx.vendorSolicitorContactId)) filesByContact.set(tx.vendorSolicitorContactId, []);
      filesByContact.get(tx.vendorSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "vendor" });
    }
    if (tx.purchaserSolicitorContactId) {
      if (!filesByContact.has(tx.purchaserSolicitorContactId)) filesByContact.set(tx.purchaserSolicitorContactId, []);
      filesByContact.get(tx.purchaserSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "purchaser" });
    }
  }

  const firms = await prisma.solicitorFirm.findMany({
    where: { id: { in: [...firmIds] } },
    orderBy: { name: "asc" },
    include: { handlers: { orderBy: { name: "asc" } } },
  });

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    totalActiveFiles: new Set([
      ...(vendorByFirm.get(firm.id) ?? []),
      ...(purchaserByFirm.get(firm.id) ?? []),
    ]).size,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: filesByContact.get(h.id) ?? [],
    })),
  }));
}

export async function getSolicitorDirectory(agencyId: string): Promise<SolicitorFirmWithStats[]> {
  const firms = await prisma.solicitorFirm.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    include: {
      handlers: {
        orderBy: { name: "asc" },
        include: {
          vendorForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true },
          },
          purchaserForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true },
          },
        },
      },
      vendorForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true },
      },
      purchaserForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true },
      },
    },
  });

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    totalActiveFiles: new Set([
      ...firm.vendorForTransactions.map((t) => t.id),
      ...firm.purchaserForTransactions.map((t) => t.id),
    ]).size,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: [
        ...h.vendorForTransactions.map((t) => ({ ...t, role: "vendor" as const })),
        ...h.purchaserForTransactions.map((t) => ({ ...t, role: "purchaser" as const })),
      ],
    })),
  }));
}

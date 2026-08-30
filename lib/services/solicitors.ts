import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { Prisma, TransactionStatus } from "@prisma/client";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";

export type SolicitorContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role: "vendor" | "purchaser"; isReferral: boolean }[];
};

export type SolicitorFirmWithStats = {
  id: string;
  name: string;
  totalActiveFiles: number;
  referralActiveFiles: number;
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
  return solicitorDirectoryFromWhere(txFilter);
}

/** Returns solicitor firms scoped for internal staff (access-scope aware). */
export async function getSolicitorDirectoryForScope(scope: AccessScope): Promise<SolicitorFirmWithStats[]> {
  const activeStatuses = ["active", "on_hold"] as TransactionStatus[];
  return solicitorDirectoryFromWhere({ ...scopeTransactionWhere(scope), status: { in: activeStatuses } });
}

async function solicitorDirectoryFromWhere(
  txFilter: Prisma.PropertyTransactionWhereInput,
): Promise<SolicitorFirmWithStats[]> {
  const transactions = await prisma.propertyTransaction.findMany({
    where: txFilter,
    select: {
      id: true,
      propertyAddress: true,
      vendorSolicitorFirmId: true,
      purchaserSolicitorFirmId: true,
      vendorSolicitorContactId: true,
      purchaserSolicitorContactId: true,
      referredFirmId: true,
    },
  });

  const firmIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) firmIds.add(tx.vendorSolicitorFirmId);
    if (tx.purchaserSolicitorFirmId) firmIds.add(tx.purchaserSolicitorFirmId);
  }

  if (firmIds.size === 0) return [];

  const vendorByFirm = new Map<string, Set<string>>();
  const purchaserByFirm = new Map<string, Set<string>>();
  const referralByFirm = new Map<string, Set<string>>();
  const filesByContact = new Map<string, { id: string; propertyAddress: string; role: "vendor" | "purchaser"; referredFirmId: string | null }[]>();

  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) {
      if (!vendorByFirm.has(tx.vendorSolicitorFirmId)) vendorByFirm.set(tx.vendorSolicitorFirmId, new Set());
      vendorByFirm.get(tx.vendorSolicitorFirmId)!.add(tx.id);
    }
    if (tx.purchaserSolicitorFirmId) {
      if (!purchaserByFirm.has(tx.purchaserSolicitorFirmId)) purchaserByFirm.set(tx.purchaserSolicitorFirmId, new Set());
      purchaserByFirm.get(tx.purchaserSolicitorFirmId)!.add(tx.id);
    }
    if (tx.referredFirmId) {
      if (!referralByFirm.has(tx.referredFirmId)) referralByFirm.set(tx.referredFirmId, new Set());
      referralByFirm.get(tx.referredFirmId)!.add(tx.id);
    }
    if (tx.vendorSolicitorContactId) {
      if (!filesByContact.has(tx.vendorSolicitorContactId)) filesByContact.set(tx.vendorSolicitorContactId, []);
      filesByContact.get(tx.vendorSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "vendor", referredFirmId: tx.referredFirmId ?? null });
    }
    if (tx.purchaserSolicitorContactId) {
      if (!filesByContact.has(tx.purchaserSolicitorContactId)) filesByContact.set(tx.purchaserSolicitorContactId, []);
      filesByContact.get(tx.purchaserSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "purchaser", referredFirmId: tx.referredFirmId ?? null });
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
    referralActiveFiles: referralByFirm.get(firm.id)?.size ?? 0,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: (filesByContact.get(h.id) ?? []).map((f) => ({
        id: f.id,
        propertyAddress: f.propertyAddress,
        role: f.role,
        isReferral: f.referredFirmId === firm.id,
      })),
    })),
  }));
}

export type FirmFileRow = {
  id: string;
  propertyAddress: string;
  status: string;
  role: "vendor" | "purchaser" | "both";
  isReferral: boolean;
  createdAt: Date;
};

export type SolicitorFirmDetail = {
  id: string;
  name: string;
  contacts: { id: string; name: string; phone: string | null; email: string | null; secondaryEmail: string | null }[];
  files: FirmFileRow[];
};

/**
 * Full detail for one solicitor firm, scoped to the agent's visible files
 * (all statuses except draft, so completed files show too). Returns null when
 * the firm has no file the agent can see — which doubles as the access guard.
 */
export async function getSolicitorFirmDetail(vis: AgentVisibility, firmId: string): Promise<SolicitorFirmDetail | null> {
  const baseWhere = vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId }
    : { agentUserId: vis.userId };
  return solicitorFirmDetailFromWhere(baseWhere, firmId);
}

/** Solicitor firm detail scoped for internal staff (access-scope aware). */
export async function getSolicitorFirmDetailForScope(scope: AccessScope, firmId: string): Promise<SolicitorFirmDetail | null> {
  return solicitorFirmDetailFromWhere(scopeTransactionWhere(scope), firmId);
}

async function solicitorFirmDetailFromWhere(
  baseWhere: Prisma.PropertyTransactionWhereInput,
  firmId: string,
): Promise<SolicitorFirmDetail | null> {
  const [firm, transactions] = await Promise.all([
    prisma.solicitorFirm.findUnique({
      where: { id: firmId },
      select: {
        id: true,
        name: true,
        handlers: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, phone: true, email: true, secondaryEmail: true },
        },
      },
    }),
    prisma.propertyTransaction.findMany({
      where: {
        ...baseWhere,
        status: { not: "draft" as TransactionStatus },
        OR: [{ vendorSolicitorFirmId: firmId }, { purchaserSolicitorFirmId: firmId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        createdAt: true,
        referredFirmId: true,
        vendorSolicitorFirmId: true,
        purchaserSolicitorFirmId: true,
      },
    }),
  ]);

  if (!firm || transactions.length === 0) return null;

  const files: FirmFileRow[] = transactions.map((tx) => {
    const isVendor = tx.vendorSolicitorFirmId === firmId;
    const isPurchaser = tx.purchaserSolicitorFirmId === firmId;
    return {
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      role: isVendor && isPurchaser ? "both" : isVendor ? "vendor" : "purchaser",
      isReferral: tx.referredFirmId === firmId,
      createdAt: tx.createdAt,
    };
  });

  return { id: firm.id, name: firm.name, contacts: firm.handlers, files };
}

export async function getSolicitorDirectory(agencyId: string): Promise<SolicitorFirmWithStats[]> {
  const firms = await prisma.solicitorFirm.findMany({
    orderBy: { name: "asc" },
    include: {
      handlers: {
        orderBy: { name: "asc" },
        include: {
          vendorForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true, referredFirmId: true },
          },
          purchaserForTransactions: {
            where: { agencyId, status: { in: ["active", "on_hold"] } },
            select: { id: true, propertyAddress: true, referredFirmId: true },
          },
        },
      },
      vendorForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true, referredFirmId: true },
      },
      purchaserForTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true, referredFirmId: true },
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
    referralActiveFiles: new Set([
      ...firm.vendorForTransactions.filter((t) => t.referredFirmId === firm.id).map((t) => t.id),
      ...firm.purchaserForTransactions.filter((t) => t.referredFirmId === firm.id).map((t) => t.id),
    ]).size,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: [
        ...h.vendorForTransactions.map((t) => ({ id: t.id, propertyAddress: t.propertyAddress, role: "vendor" as const, isReferral: t.referredFirmId === firm.id })),
        ...h.purchaserForTransactions.map((t) => ({ id: t.id, propertyAddress: t.propertyAddress, role: "purchaser" as const, isReferral: t.referredFirmId === firm.id })),
      ],
    })),
  }));
}

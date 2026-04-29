// lib/services/chains.ts

import { prisma } from "@/lib/prisma";

export type ChainLinkData = {
  id: string;
  position: number;
  transactionId: string | null;
  externalAddress: string | null;
  externalStatus: string | null;
  transaction?: {
    id: string;
    propertyAddress: string;
    status: string;
    expectedExchangeDate: Date | null;
    vendorSolicitorFirm: { name: string } | null;
    purchaserSolicitorFirm: { name: string } | null;
    milestoneCompletions: { completedAt: Date | null }[];
  } | null;
};

export type ChainData = {
  id: string;
  name: string | null;
  links: ChainLinkData[];
};

export async function getChainForTransaction(transactionId: string): Promise<ChainData | null> {
  const link = await prisma.chainLink.findFirst({
    where: { transactionId },
    include: {
      chain: {
        include: {
          links: {
            orderBy: { position: "asc" },
            include: {
              transaction: {
                select: {
                  id: true,
                  propertyAddress: true,
                  status: true,
                  expectedExchangeDate: true,
                  vendorSolicitorFirm: { select: { name: true } },
                  purchaserSolicitorFirm: { select: { name: true } },
                  milestoneCompletions: {
                    where: { state: "complete" },
                    orderBy: { completedAt: "desc" },
                    take: 1,
                    select: { completedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return link?.chain ?? null;
}

export async function createChain(agencyId: string, name: string | null) {
  return prisma.propertyChain.create({
    data: { agencyId, name },
  });
}

export async function upsertChainLink(chainId: string, position: number, data: {
  transactionId?: string | null;
  externalAddress?: string | null;
  externalStatus?: string | null;
}) {
  const existing = await prisma.chainLink.findFirst({ where: { chainId, position } });
  if (existing) {
    return prisma.chainLink.update({ where: { id: existing.id }, data });
  }
  return prisma.chainLink.create({ data: { chainId, position, ...data } });
}

export async function deleteChainLink(linkId: string) {
  return prisma.chainLink.delete({ where: { id: linkId } });
}

export async function deleteChain(chainId: string) {
  return prisma.propertyChain.delete({ where: { id: chainId } });
}

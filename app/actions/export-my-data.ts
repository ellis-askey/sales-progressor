"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function exportMyData() {
  const session = await requireSession();
  const userId  = session.user.id;
  const agencyId = session.user.agencyId ?? null;

  const [user, notes, comms, tasks, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        firmName: true, phone: true, createdAt: true,
      },
    }),
    prisma.transactionNote.findMany({
      where: { createdById: userId },
      select: { id: true, content: true, createdAt: true, transactionId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outboundMessage.findMany({
      where: { createdById: userId },
      select: { id: true, type: true, content: true, createdAt: true, transactionId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.manualTask.findMany({
      where: { createdById: userId },
      select: { id: true, title: true, notes: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    agencyId
      ? prisma.propertyTransaction.findMany({
          where: { agencyId },
          select: {
            id: true, propertyAddress: true, status: true,
            purchasePrice: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    exportedAt:     new Date().toISOString(),
    user,
    transactions,
    notes,
    communications: comms,
    tasks,
  };
}

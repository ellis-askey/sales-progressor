import { prisma } from "@/lib/prisma";

export async function touchLastActivity(transactionId: string): Promise<void> {
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { lastActivityAt: new Date() },
  });
}

export async function logActivity(
  transactionId: string,
  content: string,
  actorId: string
): Promise<void> {
  await Promise.all([
    prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "internal_note",
        contactIds: [],
        content,
        createdById: actorId,
      },
    }),
    touchLastActivity(transactionId),
  ]);
}

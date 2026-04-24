import { prisma } from "@/lib/prisma";

export async function logActivity(
  transactionId: string,
  content: string,
  actorId: string
): Promise<void> {
  await prisma.communicationRecord.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content,
      createdById: actorId,
    },
  });
}

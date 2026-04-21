import { prisma } from "@/lib/prisma";

export type TransactionNoteItem = {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
};

export async function getNotesForTransaction(transactionId: string): Promise<TransactionNoteItem[]> {
  return prisma.transactionNote.findMany({
    where: { transactionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<TransactionNoteItem[]>;
}

export async function createNote(
  transactionId: string,
  content: string,
  createdById: string
): Promise<TransactionNoteItem> {
  return prisma.transactionNote.create({
    data: { transactionId, content, createdById },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  }) as Promise<TransactionNoteItem>;
}

export async function deleteNote(id: string): Promise<void> {
  await prisma.transactionNote.delete({ where: { id } });
}

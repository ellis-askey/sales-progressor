// Conversation key + race-safe resolver for native messaging.
//
// A buyer conversation is scoped to the file's ACTIVE buyer round; a seller
// conversation is always file-level (null round). getOrCreateConversation
// cooperates with the two partial unique indexes added in the Phase 0 migration
// so concurrent callers can never produce a duplicate conversation: if two
// requests race to create the same (transaction, side, round) row, the second
// loses on the unique index (P2002) and re-reads the winner.
//
// No UI caller yet (Phase 0). The Phase 1 send path will call this, passing a
// transaction client so the create participates in the send transaction.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { MessagingSide } from "./side";

// The round a conversation of this side belongs to: the active round for a
// buyer conversation, always null for a seller conversation.
export function buyerRoundIdForSide(
  side: MessagingSide,
  activeBuyerRoundId: string | null,
): string | null {
  return side === "buyer" ? activeBuyerRoundId : null;
}

export async function getOrCreateConversation(params: {
  transactionId: string;
  side: MessagingSide;
  activeBuyerRoundId: string | null;
}): Promise<{ id: string }> {
  const { transactionId, side } = params;
  const buyerRoundId = buyerRoundIdForSide(side, params.activeBuyerRoundId);
  const where = { transactionId, side, buyerRoundId } as const;

  const existing = await prisma.conversation.findFirst({ where, select: { id: true } });
  if (existing) return existing;

  try {
    return await prisma.conversation.create({
      data: { transactionId, side, buyerRoundId },
      select: { id: true },
    });
  } catch (e) {
    // Lost a create race — a partial unique index rejected the duplicate. Re-read
    // the row the winning request created.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.conversation.findFirst({ where, select: { id: true } });
      if (row) return row;
    }
    throw e;
  }
}

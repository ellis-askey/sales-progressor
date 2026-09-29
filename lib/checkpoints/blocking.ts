import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Parties that must confirm a checkpoint, derived from its audience.
export function requiredParties(showTo: string): string[] {
  if (showTo === "both") return ["vendor", "purchaser"];
  if (showTo === "none") return ["agent"];
  return [showTo]; // "vendor" | "purchaser"
}

// True if the file has any live checkpoint marked "must be done before exchange"
// that isn't fully confirmed yet. Such a checkpoint holds the exchange gate shut
// on BOTH sides — exchange is a joint event, so a probate grant (etc.) that isn't
// through blocks the whole thing, not one side. Kept dependency-free (prisma
// only) so lib/services/milestones.ts can import it without an import cycle.
export async function hasOpenBlockingCheckpoints(
  transactionId: string,
  tx?: Prisma.TransactionClient,
): Promise<boolean> {
  const db = tx ?? prisma;
  const blocking = await db.checkpoint.findMany({
    where: { transactionId, blocksExchange: true, archivedAt: null },
    select: { showTo: true, confirmations: { select: { party: true } } },
  });
  for (const c of blocking) {
    const required = requiredParties(c.showTo);
    const done = new Set<string>(c.confirmations.map((x) => x.party));
    if (!required.every((p) => done.has(p))) return true;
  }
  return false;
}

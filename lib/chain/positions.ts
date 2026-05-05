// lib/chain/positions.ts
// Position management helpers for chain link ordering.
// Positions are 0-indexed, top of chain = 0.
// All shift operations must be wrapped in a DB transaction by the caller.

import { prisma } from "@/lib/prisma";

type PositionedLink = { id: string; position: number };

// Returns the position for a brand-new link inserted above all existing links.
// Caller must also shift all existing links' positions up by 1 (shiftAllUp).
export function positionForNewTop(): number {
  return 0;
}

// Returns the position for a brand-new link inserted below all existing links.
export function positionForNewBottom(links: PositionedLink[]): number {
  if (links.length === 0) return 0;
  return Math.max(...links.map((l) => l.position)) + 1;
}

// Returns the position for a node inserted immediately above `aboveLinkPosition`.
// All links with position >= aboveLinkPosition must shift +1.
export function positionForInsertAbove(aboveLinkPosition: number): number {
  return aboveLinkPosition;
}

// Shift all links in a chain that have position >= threshold up by 1.
// Must be called inside a DB transaction.
export async function shiftPositionsUp(
  chainId: string,
  fromPosition: number,
): Promise<void> {
  // Shift in descending order to avoid temporary unique constraint violations
  const links = await prisma.chainLink.findMany({
    where: { chainId, position: { gte: fromPosition } },
    orderBy: { position: "desc" },
  });

  for (const link of links) {
    await prisma.chainLink.update({
      where: { id: link.id },
      data: { position: link.position + 1 },
    });
  }
}

// Repack positions after a deletion so they stay contiguous.
// (Optional — only needed if contiguity is relied on elsewhere.)
export async function repackPositions(chainId: string): Promise<void> {
  const links = await prisma.chainLink.findMany({
    where: { chainId },
    orderBy: { position: "asc" },
  });

  for (let i = 0; i < links.length; i++) {
    if (links[i].position !== i) {
      await prisma.chainLink.update({
        where: { id: links[i].id },
        data: { position: i },
      });
    }
  }
}

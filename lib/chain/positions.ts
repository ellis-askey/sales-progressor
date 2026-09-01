// lib/chain/positions.ts
// Position management helpers for chain link ordering.
// Positions are 0-indexed, top of chain = 0.
// All shift operations must be wrapped in a DB transaction by the caller.

import { prisma } from "@/lib/prisma";

type PositionedLink = { id: string; position: number };

// Display convention: bottom of chain = #1, counting upward to the top.
// DB position 0 (top of chain) displays as #N. DB position N-1 (bottom) displays as #1.
// Every display surface must route through this helper — no per-surface +1 math.
export function displayChainPosition(dbPosition: number, totalLinks: number): number {
  return totalLinks - dbPosition;
}

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

// Shift all links in ONE branch that have position >= threshold up by 1.
// branchKey scopes the shift to a single ladder (default "" = the main spine),
// so inserting into one branch never disturbs another. Must be called inside a
// DB transaction.
export async function shiftPositionsUp(
  chainId: string,
  fromPosition: number,
  branchKey = "",
): Promise<void> {
  // Shift in descending order to avoid temporary unique constraint violations
  const links = await prisma.chainLink.findMany({
    where: { chainId, branchKey, position: { gte: fromPosition } },
    orderBy: { position: "desc" },
  });

  for (const link of links) {
    await prisma.chainLink.update({
      where: { id: link.id },
      data: { position: link.position + 1 },
    });
  }
}

// Repack positions in ONE branch after a deletion so they stay contiguous.
// branchKey scopes it to a single ladder (default "" = the main spine).
// (Optional — only needed if contiguity is relied on elsewhere.)
export async function repackPositions(chainId: string, branchKey = ""): Promise<void> {
  const links = await prisma.chainLink.findMany({
    where: { chainId, branchKey },
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

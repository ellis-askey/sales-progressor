// Sticky notes on a property file — internal scratchpad. Read path only here;
// writes live in app/actions/sticky-notes.ts. Everything is gated by file
// ownership (access-scope helper, Law 7): the notes are only returned to someone
// who can open the file, and never reach the client portal.

import { prisma } from "@/lib/prisma";
import { scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";

export type StickyNoteDTO = {
  id: string;
  x: number; y: number;
  width: number; height: number;
  z: number;
  colour: string;
  text: string;
  collapsed: boolean;
  author: string;
  createdAt: number; // ms
};

export async function getStickyNotesForFile(transactionId: string, scope: AccessScope): Promise<StickyNoteDTO[]> {
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!owned) return [];

  const rows = await prisma.stickyNote.findMany({
    where: { transactionId },
    orderBy: { z: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    x: r.x, y: r.y, width: r.width, height: r.height, z: r.z,
    colour: r.colour, text: r.text, collapsed: r.collapsed,
    author: r.createdByName ?? "Someone",
    createdAt: r.createdAt.getTime(),
  }));
}

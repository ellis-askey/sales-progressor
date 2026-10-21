"use server";

// Sticky-note writes. Every call re-verifies the caller can open the file (Law 7
// via scopeOwnershipWhere), and every mutation is additionally scoped by
// transactionId so a note can only be touched through its own file. The client
// supplies the note id (a cuid) so optimistic creates need no reconciliation.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

const COLOURS = new Set(["butter", "coral", "sage", "sky", "lilac", "slate"]);
const clampColour = (c: string) => (COLOURS.has(c) ? c : "butter");

async function guard(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  return owned ? session : null;
}

export async function createStickyNote(input: {
  id: string; transactionId: string;
  x: number; y: number; width: number; height: number; z: number; colour: string;
}): Promise<{ ok: boolean }> {
  const session = await guard(input.transactionId);
  if (!session) return { ok: false };
  await prisma.stickyNote.create({
    data: {
      id: input.id,
      transactionId: input.transactionId,
      x: Math.round(input.x), y: Math.round(input.y),
      width: Math.round(input.width), height: Math.round(input.height),
      z: Math.round(input.z),
      colour: clampColour(input.colour),
      text: "",
      createdById: session.user.id,
      createdByName: session.user.name ?? null,
    },
  });
  return { ok: true };
}

export async function updateStickyNote(
  id: string,
  transactionId: string,
  patch: { x?: number; y?: number; width?: number; height?: number; z?: number; colour?: string; text?: string; collapsed?: boolean },
): Promise<{ ok: boolean }> {
  const session = await guard(transactionId);
  if (!session) return { ok: false };
  const data: Record<string, unknown> = {};
  if (patch.x != null) data.x = Math.round(patch.x);
  if (patch.y != null) data.y = Math.round(patch.y);
  if (patch.width != null) data.width = Math.round(patch.width);
  if (patch.height != null) data.height = Math.round(patch.height);
  if (patch.z != null) data.z = Math.round(patch.z);
  if (patch.colour != null) data.colour = clampColour(patch.colour);
  if (patch.text != null) data.text = patch.text.slice(0, 4000);
  if (patch.collapsed != null) data.collapsed = patch.collapsed;
  if (Object.keys(data).length === 0) return { ok: true };
  await prisma.stickyNote.updateMany({ where: { id, transactionId }, data });
  return { ok: true };
}

export async function deleteStickyNote(id: string, transactionId: string): Promise<{ ok: boolean }> {
  const session = await guard(transactionId);
  if (!session) return { ok: false };
  await prisma.stickyNote.deleteMany({ where: { id, transactionId } });
  return { ok: true };
}

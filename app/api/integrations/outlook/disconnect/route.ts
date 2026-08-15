// POST /api/integrations/outlook/disconnect  { id: string }
//
// Removes one of the current user's Outlook mailboxes (deletes its stored
// tokens). Scoped to the authenticated session user — a user can only
// disconnect their own mailbox, identified by connection id.

import { NextResponse } from "next/server";
import { requireSession, forbidViewer } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await requireSession();
  const viewerBlock = forbidViewer(session);
  if (viewerBlock) return viewerBlock;

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }

  // deleteMany with both id AND userId guarantees a user can't delete someone
  // else's connection even if they guess an id.
  await prisma.outlookConnection.deleteMany({
    where: { id: body.id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}

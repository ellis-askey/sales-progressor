// POST /api/integrations/outlook/disconnect
//
// Removes the current user's Outlook connection (deletes the stored tokens).
// Scoped to the authenticated session user — a user can only disconnect their
// own mailbox.

import { NextResponse } from "next/server";
import { requireSession, forbidViewer } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await requireSession();
  const viewerBlock = forbidViewer(session);
  if (viewerBlock) return viewerBlock;

  await prisma.outlookConnection.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

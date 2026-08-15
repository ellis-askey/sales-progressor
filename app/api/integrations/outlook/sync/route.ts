// POST /api/integrations/outlook/sync  { connectionId: string }
//
// Reads recent Inbox messages for one of the current user's connected mailboxes
// and logs the ones that confidently match a property file. Returns a summary.
// Scoped to the session user: you can only sync your own mailbox, and it only
// matches against files you're allowed to see.

import { NextResponse } from "next/server";
import { requireSession, forbidViewer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncOutlookMailbox } from "@/lib/integrations/outlook/sync";

export async function POST(req: Request) {
  const session = await requireSession();
  const viewerBlock = forbidViewer(session);
  if (viewerBlock) return viewerBlock;

  const body = (await req.json().catch(() => ({}))) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  const conn = await prisma.outlookConnection.findFirst({
    where: { id: body.connectionId, userId: session.user.id },
    select: {
      id: true,
      email: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
      scope: true,
    },
  });
  if (!conn) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const summary = await syncOutlookMailbox(conn, session);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[outlook] sync failed:", (err as Error).message);
    return NextResponse.json({ error: "sync_failed" }, { status: 502 });
  }
}

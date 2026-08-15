// POST /api/integrations/outlook/log-message  { connectionId, messageId, transactionId }
//
// Hand-logs a single Outlook message onto a chosen property file (used from the
// sync review UI to place a missed email). Scoped to the session user: you can
// only use your own mailbox, and only attach to a file you're allowed to see.

import { NextResponse } from "next/server";
import { requireSession, forbidViewer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { logSingleMessageToFile } from "@/lib/integrations/outlook/sync";

export async function POST(req: Request) {
  const session = await requireSession();
  const viewerBlock = forbidViewer(session);
  if (viewerBlock) return viewerBlock;

  const body = (await req.json().catch(() => ({}))) as {
    connectionId?: string;
    messageId?: string;
    transactionId?: string;
  };
  if (!body.connectionId || !body.messageId || !body.transactionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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
  if (!conn) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

  // Verify the target file is in the user's scope before attaching anything.
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, body.transactionId),
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    const item = await logSingleMessageToFile(conn, body.transactionId, body.messageId);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[outlook] log-message failed:", (err as Error).message);
    return NextResponse.json({ error: "log_failed" }, { status: 502 });
  }
}

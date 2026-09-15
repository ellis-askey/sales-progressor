// POST /api/integrations/imap/sync  { connectionId }
//
// Reads recent mail for one of the caller's IMAP mailboxes and logs the messages
// that confidently match a property file. Scoped to the session user: you can
// only sync your own mailbox, and it only matches files you're allowed to see.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncImapMailbox } from "@/lib/integrations/imap/sync";

export async function POST(req: Request) {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  const conn = await prisma.imapConnection.findFirst({
    where: { id: body.connectionId, userId: session.user.id },
    select: { id: true, email: true, provider: true, host: true, port: true, secure: true, encryptedPassword: true },
  });
  if (!conn) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  try {
    const summary = await syncImapMailbox(conn, session);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[imap] sync failed:", (err as Error).message);
    return NextResponse.json({ error: "sync_failed" }, { status: 502 });
  }
}

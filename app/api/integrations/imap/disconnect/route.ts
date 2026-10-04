// POST /api/integrations/imap/disconnect  { id }
//
// Removes one of the caller's IMAP mailboxes (deletes its stored, encrypted
// app-password). Scoped to the session user by id AND userId, so a user can only
// ever disconnect their own mailbox.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { canUseAgentMailbox } from "@/lib/integrations/mailbox-access";
import { disconnectImap } from "@/lib/integrations/imap/connections";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!canUseAgentMailbox(session.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }

  await disconnectImap(session.user.id, body.id);
  return NextResponse.json({ ok: true });
}

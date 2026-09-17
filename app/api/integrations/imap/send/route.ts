// POST /api/integrations/imap/send
//   { id, enable }
//
// Turns mailbox SENDING on or off for a connection the caller owns. Enabling
// verifies the stored app-password against the provider's SMTP server first
// and fires a one-off confirmation email to the mailbox itself; disabling
// leaves receiving untouched. Same role gate as connect.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enableMailboxSending, disableMailboxSending } from "@/lib/integrations/imap/connections";

export async function POST(req: Request) {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; enable?: boolean };
  if (!body.id || typeof body.enable !== "boolean") {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  if (body.enable) {
    const result = await enableMailboxSending(session.user.id, body.id);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  await disableMailboxSending(session.user.id, body.id);
  return NextResponse.json({ ok: true });
}

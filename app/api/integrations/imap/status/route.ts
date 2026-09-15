// GET /api/integrations/imap/status — the caller's own IMAP mailboxes.
// IMAP needs no server config (per-user app-passwords), so it's always available;
// `configured` is true to mirror the Outlook status shape for the UI.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getMyImapStatus } from "@/lib/integrations/imap/connections";

export async function GET() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = await getMyImapStatus(session.user.id);
  return NextResponse.json({ configured: true, ...status });
}

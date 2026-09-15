// POST /api/integrations/imap/connect
//   { email, password, displayName?, host?, port?, secure?, consent }
//
// Verifies the app-password against the mail server, then stores the connection
// (encrypted) for the caller. Consent is required, matching the Outlook flow —
// this is where affirmative consent for mailbox reading is captured for IMAP.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { connectImapMailbox } from "@/lib/integrations/imap/connections";

export async function POST(req: Request) {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    displayName?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    consent?: boolean;
  };

  if (!body.consent) {
    return NextResponse.json({ ok: false, error: "Please tick the consent box to connect your inbox." }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: "Enter your email address and app-password." }, { status: 400 });
  }

  const result = await connectImapMailbox(session.user.id, {
    email: body.email,
    password: body.password,
    displayName: body.displayName,
    host: body.host,
    port: typeof body.port === "number" ? body.port : undefined,
    secure: typeof body.secure === "boolean" ? body.secure : undefined,
  });

  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

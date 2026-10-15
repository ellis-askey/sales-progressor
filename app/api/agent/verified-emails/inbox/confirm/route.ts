import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { confirmInboxCode } from "@/lib/services/verified-emails";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  // Director-only: match the director gate on the UI surface and the sibling
  // domain / inbox routes.
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Only directors can manage the agency's email domain." }, { status: 403 });
  }
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const result = await confirmInboxCode(session.user.id, email, code);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

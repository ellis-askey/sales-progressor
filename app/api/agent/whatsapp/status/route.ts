// Agent-facing WhatsApp connection status (Phase 3). Scoped to the caller.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getMyWhatsAppStatus } from "@/lib/integrations/whatsapp/agent-connections";

export async function GET() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = await getMyWhatsAppStatus(session.user.id);
  return NextResponse.json(status);
}

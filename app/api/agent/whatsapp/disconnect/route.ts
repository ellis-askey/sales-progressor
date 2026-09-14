// Agent-facing WhatsApp disconnect (Phase 3). Scoped to the caller.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { disconnectMyWhatsApp } from "@/lib/integrations/whatsapp/agent-connections";

export async function POST() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await disconnectMyWhatsApp(session.user.id);
  return NextResponse.json({ ok: true });
}

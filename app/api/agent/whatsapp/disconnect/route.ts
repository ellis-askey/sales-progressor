// Agent-facing WhatsApp disconnect (Phase 3). Scoped to the caller.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { disconnectMyWhatsApp } from "@/lib/integrations/whatsapp/agent-connections";
import { canUseWhatsAppConnect } from "@/lib/integrations/whatsapp/connect-access";

export async function POST() {
  const session = await requireSession();
  if (!(await canUseWhatsAppConnect(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await disconnectMyWhatsApp(session.user.id);
  return NextResponse.json({ ok: true });
}

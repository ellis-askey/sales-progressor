// Agent-facing WhatsApp pairing start (Phase 3). Requires the consent tick.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { startMyWhatsAppPairing } from "@/lib/integrations/whatsapp/agent-connections";

export async function POST(req: Request) {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { consent?: boolean };
  if (body.consent !== true) {
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }
  const res = await startMyWhatsAppPairing(session.user.id);
  if (!res.ok) {
    const status = res.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: res.error ?? "failed" }, { status });
  }
  return NextResponse.json({ ok: true, connectionId: res.connectionId });
}

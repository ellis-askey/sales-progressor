// Agent-facing WhatsApp pairing start (Phase 3). Requires the consent tick.
// Pivot 2026-10-18: external progression-business members may link too — their
// capture scopes to their own business's files (connect-access + ingest scope).
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { startMyWhatsAppPairing } from "@/lib/integrations/whatsapp/agent-connections";
import { canUseWhatsAppConnect } from "@/lib/integrations/whatsapp/connect-access";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!(await canUseWhatsAppConnect(session))) {
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

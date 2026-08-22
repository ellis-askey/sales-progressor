// POST /api/integrations/whatsapp/ingest
//
// Machine-to-machine endpoint the off-platform WhatsApp bridge posts normalised
// messages to. Auth: Authorization: Bearer ${WHATSAPP_BRIDGE_SECRET} (checked
// in-handler; the path is whitelisted in middleware.ts so the session gate is
// bypassed, same pattern as the cron routes). See docs/WHATSAPP_INTEGRATION.md §6.

import { NextResponse } from "next/server";
import { getWhatsAppBridgeSecret } from "@/lib/integrations/whatsapp/config";
import { ingestWhatsAppMessages, type BridgeMessage } from "@/lib/integrations/whatsapp/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = getWhatsAppBridgeSecret();
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { messages?: BridgeMessage[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const results = await ingestWhatsAppMessages(messages);
  return NextResponse.json({ ok: true, results });
}

// Meta WhatsApp Cloud API webhook (Phase 1, REBUILD_PLAN §C3).
// GET  — Meta's one-time verification handshake (echo hub.challenge).
// POST — signature-verified event intake: ack fast, store idempotently.
// Auth model: no session (middleware whitelists /api/webhooks/); the GET is
// guarded by the shared verify token, the POST by the X-Hub-Signature-256
// HMAC over the raw body with the Meta app secret.

import { NextRequest, NextResponse } from "next/server";
import { cloudEnv } from "@/lib/integrations/whatsapp-cloud/config";
import { verifyMetaSignature } from "@/lib/integrations/whatsapp-cloud/signature";
import { storeWebhookEvents } from "@/lib/integrations/whatsapp-cloud/events";
import { routeUnprocessedEvents } from "@/lib/integrations/whatsapp-cloud/threads";

export async function GET(req: NextRequest) {
  const env = cloudEnv();
  if (!env) return new NextResponse("Not configured", { status: 503 });
  const params = req.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === env.verifyToken) {
    // Meta expects the raw challenge value back as the response body.
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(req: NextRequest) {
  const env = cloudEnv();
  if (!env) return new NextResponse("Not configured", { status: 503 });

  // Signature is computed over the RAW body — read text before parsing.
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env.appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  try {
    await storeWebhookEvents(body as Parameters<typeof storeWebhookEvents>[0]);
  } catch (e) {
    // Non-200 → Meta redelivers; the store is idempotent, so a retry after a
    // transient DB blip loses nothing and double-delivers nothing.
    console.error("[whatsapp-cloud] webhook store failed", e);
    return new NextResponse("Store failed", { status: 500 });
  }

  // Route stored messages into threads (Phase 2) and apply status events to
  // the ledger (Phase 3). Best-effort on the hot path: a failure never fails
  // the webhook (events stay unprocessed; the next delivery's pass resumes).
  try {
    await routeUnprocessedEvents();
  } catch (e) {
    console.error("[whatsapp-cloud] thread routing failed", e);
  }
  try {
    const { applyUnprocessedStatuses } = await import("@/lib/integrations/whatsapp-cloud/ledger");
    await applyUnprocessedStatuses();
  } catch (e) {
    console.error("[whatsapp-cloud] status apply failed", e);
  }
  return NextResponse.json({ ok: true });
}

// POST /api/integrations/whatsapp/media
//
// The bridge posts a downloaded WhatsApp attachment here (base64) after the
// message itself has been ingested. We store it in the private whatsapp-media
// bucket and attach the object path to the logged message (or the pending row).
// Bearer auth, same secret as the ingest endpoint. See docs/WHATSAPP_INTEGRATION.md.

import { NextResponse } from "next/server";
import { getWhatsAppBridgeSecret } from "@/lib/integrations/whatsapp/config";
import { uploadWhatsAppMedia } from "@/lib/supabase-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — comfortably above WhatsApp's media cap

function extFor(mime: string, filename?: string): string {
  if (filename && filename.includes(".")) {
    return filename.split(".").pop()!.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "bin";
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "application/pdf": "pdf", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "video/mp4": "mp4", "video/3gpp": "3gp",
  };
  return map[mime] ?? "bin";
}

export async function POST(req: Request) {
  const secret = getWhatsAppBridgeSecret();
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { waMessageId?: string; mimetype?: string; filename?: string; dataBase64?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { waMessageId, mimetype, filename, dataBase64 } = payload;
  if (!waMessageId || !dataBase64) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const safeId = waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `wa/${safeId}.${extFor(mimetype ?? "", filename)}`;
  try {
    await uploadWhatsAppMedia(path, buffer, mimetype ?? "application/octet-stream");
  } catch (err) {
    console.error("[whatsapp] media upload failed", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  // Attach to the logged message; if it's still unmatched, attach to the pending
  // row so it carries through when the chat is assigned.
  const logged = await prisma.outboundMessage.updateMany({
    where: { method: "whatsapp", providerMessageId: waMessageId },
    data: { mediaUrl: path },
  });
  if (logged.count === 0) {
    await prisma.whatsAppPendingMessage.updateMany({ where: { waMessageId }, data: { mediaUrl: path } });
  }

  return NextResponse.json({ ok: true, path });
}

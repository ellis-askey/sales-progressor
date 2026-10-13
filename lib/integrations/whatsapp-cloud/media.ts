import "server-only";
// Inbound media (Phase 4b): Meta keeps media only ~30 days and its download
// URLs live 5 minutes, so the moment a media message routes we fetch the file
// and store our own copy in the private whatsapp-media bucket (same bucket the
// Baileys era used). Best-effort by design — a failed fetch leaves the message
// with its placeholder text and the raw event for a later retry.

import { graphBase } from "./config";
import { resolveAccessToken } from "./accounts";
import { uploadWhatsAppMedia } from "@/lib/supabase-storage";

const MAX_BYTES = 25 * 1024 * 1024; // mirror the Baileys-era cap

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
};

function extFor(mime: string | null): string {
  if (!mime) return "bin";
  const clean = mime.split(";")[0].trim().toLowerCase();
  return EXT_BY_MIME[clean] ?? clean.split("/")[1]?.replace(/[^a-z0-9]/g, "").slice(0, 5) ?? "bin";
}

// Fetch one media object from Meta and store it. Returns the bucket object
// path for OutboundMessage.mediaUrl, or null on any failure.
export async function fetchAndStoreCloudMedia(args: {
  mediaId: string;
  phoneNumberId: string;
  mimeType: string | null;
}): Promise<string | null> {
  try {
    const token = await resolveAccessToken(args.phoneNumberId);
    if (!token) return null;

    // Step 1: media id → short-lived download URL.
    const metaRes = await fetch(`${graphBase()}/${args.mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url) return null;
    if (meta.file_size && meta.file_size > MAX_BYTES) return null;

    // Step 2: download (the URL itself also requires the bearer token).
    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) return null;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    const mime = meta.mime_type ?? args.mimeType ?? "application/octet-stream";
    const safeId = args.mediaId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "media";
    const path = `cloud/${safeId}.${extFor(mime)}`;
    await uploadWhatsAppMedia(path, buffer, mime);
    return path;
  } catch (e) {
    console.error("[whatsapp-cloud] media fetch failed", e);
    return null;
  }
}

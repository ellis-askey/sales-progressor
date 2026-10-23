// Turning a captured reply's attachments into (a) the copies we file to the
// sale's Documents and (b) the copies that ride along on the forward we send
// the progressor.
//
// Why: SendGrid Inbound Parse delivers a reply's inline images (signature
// logos, inline screenshots) as separate file parts, each carrying a
// Content-ID. The sender's HTML references them as cid:<id>. If we forward the
// HTML without re-attaching those parts, every cid: reference renders as a
// broken image box (the signature-breakage the progressor was seeing). Here we
// carry inline parts back onto the forward WITH their Content-ID so the
// references resolve, and carry real file attachments (a replied-with PDF)
// along too. Size-capped so a huge attachment can't blow the forward — it's
// still filed to Documents regardless.

import type { EmailAttachment } from "@/lib/email";
import type { IngestAttachment } from "@/lib/integrations/mail/types";

export const FORWARD_MAX_PER_FILE = 10 * 1024 * 1024; // 10 MB per part
export const FORWARD_MAX_TOTAL = 20 * 1024 * 1024; // 20 MB across the forward

// Pure: the forward-copy descriptor for one inbound part, or null when it would
// push the forward over its size cap (still filed to Documents regardless). An
// inline part (one the sender referenced by Content-ID) carries that id,
// bracket-stripped, with disposition "inline" so the forwarded HTML's cid:
// reference resolves; everything else rides along as a normal attachment.
export function forwardAttachmentFor(
  part: { filename: string; contentType: string; content: Buffer; contentId: string | null },
  runningTotalBytes: number,
): EmailAttachment | null {
  if (part.content.length > FORWARD_MAX_PER_FILE) return null;
  if (runningTotalBytes + part.content.length > FORWARD_MAX_TOTAL) return null;
  const cid = part.contentId ? part.contentId.replace(/^<|>$/g, "").trim() : null;
  return {
    content: part.content.toString("base64"),
    filename: part.filename,
    type: part.contentType,
    disposition: cid ? "inline" : "attachment",
    ...(cid ? { content_id: cid } : {}),
  };
}

// Parse the Inbound Parse file parts into the two copies. `attachment-info`
// carries each part's `content-id` (present only for inline images); `content`
// buffers come straight from the multipart parts. Best-effort per part — an
// unreadable part never blocks the reply being filed or forwarded.
export async function parseInboundParts(form: FormData): Promise<{
  ingest: IngestAttachment[];
  forward: EmailAttachment[];
}> {
  const ingest: IngestAttachment[] = [];
  const forward: EmailAttachment[] = [];
  const count = parseInt(String(form.get("attachments") ?? "0"), 10) || 0;

  let info: Record<string, { "content-id"?: string }> = {};
  try {
    const parsed = JSON.parse(String(form.get("attachment-info") ?? "{}"));
    if (parsed && typeof parsed === "object") info = parsed as Record<string, { "content-id"?: string }>;
  } catch {
    /* no inline metadata — everything forwards as a normal attachment */
  }

  let total = 0;
  for (let i = 1; i <= count; i++) {
    const part = form.get(`attachment${i}`);
    if (!part || typeof part !== "object" || !("arrayBuffer" in part)) continue;
    try {
      const file = part as File;
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length === 0) continue;
      const filename = file.name || `attachment${i}`;
      const contentType = file.type || "application/octet-stream";

      ingest.push({ filename, contentType, content: buf, size: buf.length });

      const fwd = forwardAttachmentFor(
        { filename, contentType, content: buf, contentId: info[`attachment${i}`]?.["content-id"] ?? null },
        total,
      );
      if (fwd) {
        forward.push(fwd);
        total += buf.length;
      }
    } catch {
      /* skip an unreadable part */
    }
  }
  return { ingest, forward };
}

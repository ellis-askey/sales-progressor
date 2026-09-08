// Turn inline (base64 data:) images in a pasted custom signature into hosted
// images in our public `signatures` bucket, rewriting each src to the public URL.
//
// Why: (1) email clients (Gmail/Outlook) block inline base64 images, so a pasted
// signature's logo would vanish in the recipient's inbox; (2) hosting keeps the
// stored HTML small (Gmail clips ~102KB). Uploads are content-addressed (sha256
// of the bytes) so re-processing the same image is idempotent — no duplicate
// files and no re-upload once a signature's images are already hosted.
//
// See docs/active/email-signature/00-audit-and-plan.md §6.

import { createHash } from "node:crypto";
import { uploadSignatureImage, getSignatureImageUrl } from "@/lib/supabase-storage";

const MAX_INLINE_BYTES = 2 * 1024 * 1024; // per image
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Matches src="data:image/png;base64,…" (single or double quoted).
const DATA_IMG_RE = /src\s*=\s*(["'])(data:image\/(png|jpe?g|gif|webp);base64,[^"']+)\1/gi;

export async function processSignatureImages(html: string, userId: string): Promise<string> {
  if (!html || !html.includes("data:image/")) return html;

  // De-dupe identical data URLs so we upload each distinct image once.
  const seen = new Map<string, string>(); // dataUrl -> hosted url
  let out = html;

  for (const m of html.matchAll(DATA_IMG_RE)) {
    const dataUrl = m[2];
    if (seen.has(dataUrl)) continue;
    const rawType = m[3].toLowerCase();
    const mime = rawType === "jpg" || rawType === "jpeg" ? "image/jpeg" : `image/${rawType}`;
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      continue;
    }
    if (buf.length === 0 || buf.length > MAX_INLINE_BYTES) continue; // leave as-is; sanitiser decides

    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 24);
    const ext = EXT[mime] ?? "png";
    const path = `${userId}/inline-${hash}.${ext}`;
    try {
      await uploadSignatureImage(path, buf, mime);
      const url = getSignatureImageUrl(path);
      if (url) seen.set(dataUrl, url);
    } catch {
      // Upload failed (e.g. bucket missing) — leave the data URL in place.
    }
  }

  for (const [dataUrl, url] of seen) {
    out = out.split(dataUrl).join(url);
  }
  return out;
}

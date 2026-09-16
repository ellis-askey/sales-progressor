// Phase F1 — deciding which inbound-email attachments to file into a property's
// Documents, and normalising their names. Pure logic (no I/O) so it's unit-
// tested; the ingest core calls filterStorableAttachments() then uploads what
// survives.
//
// Policy:
//   - Skip inline parts (signature logos, tracking pixels, body images) — they
//     carry no document value and would clutter the file.
//   - Allow only the document/image types agents actually receive (contract
//     packs, searches, ID, floorplans). Everything else is dropped.
//   - Cap at 25 MB (the same ceiling as a manual upload) — anything larger is a
//     link-share, not a real attachment.
//   - Drop tiny images (< 8 KB): stray logos/pixels that weren't flagged inline.
//   - De-dupe within one email by name + size, so a resend in the same thread
//     doesn't file the same PDF twice.

import type { IngestAttachment } from "./types";

// 25 MB — matches MAX_DOCUMENT_BYTES for a manual upload (lib/upload/document-upload.ts).
export const MAX_EMAIL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Images below this are almost always signature logos or tracking pixels, not a
// document worth keeping — even when the sender didn't mark them inline.
export const MIN_IMAGE_ATTACHMENT_BYTES = 8 * 1024;

// The types an agent legitimately receives on a conveyancing file. Kept broader
// than the browser-upload allow-list (adds spreadsheets + gif/webp) because
// inbound mail is more varied than what an agent uploads by hand.
export const EMAIL_ATTACHMENT_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);

export type StorableAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
};

function normaliseMime(contentType: string): string {
  // Strip parameters ("application/pdf; name=foo") and lower-case.
  return (contentType || "").split(";")[0]!.trim().toLowerCase();
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

// Characters that are illegal in a filename on common filesystems / in a storage
// key. Built at runtime from char codes so there is no accidental range in a
// regex literal (space-to-colon would silently eat digits and dots).
const ILLEGAL_FILENAME_CHARS = (() => {
  const chars = new Set<string>();
  for (let c = 0; c <= 0x1f; c++) chars.add(String.fromCharCode(c)); // control chars
  for (const ch of [":", "*", "?", '"', "<", ">", "|"]) chars.add(ch);
  return chars;
})();

// A safe, human-readable filename. Falls back to a typed default when the
// attachment has no name (common for inline-ish parts), strips path separators
// and control/illegal chars, and caps length so it fits the storage-path builder.
export function safeAttachmentName(rawName: string | undefined | null, mime: string): string {
  const stripped = Array.from(rawName ?? "")
    .map((ch) => (ch === "/" || ch === "\\" ? "-" : ILLEGAL_FILENAME_CHARS.has(ch) ? "" : ch))
    .join("");
  const cleaned = stripped.replace(/\s+/g, " ").trim().slice(0, 180);
  if (cleaned) return cleaned;
  const ext = mime === "application/pdf" ? "pdf" : isImage(mime) ? mime.split("/")[1] : "bin";
  return `attachment.${ext}`;
}

// Given every attachment on a message, return only the ones worth filing, with
// clean names and de-duped. The caller uploads each and creates a document row.
export function filterStorableAttachments(
  attachments: IngestAttachment[] | undefined,
): StorableAttachment[] {
  if (!attachments || attachments.length === 0) return [];
  const seen = new Set<string>();
  const out: StorableAttachment[] = [];

  for (const att of attachments) {
    if (att.isInline) continue; // signature logo / body image
    if (!att.content || att.content.length === 0) continue;

    const mime = normaliseMime(att.contentType);
    if (!EMAIL_ATTACHMENT_ALLOWED_MIME.has(mime)) continue;

    const size = att.size && att.size > 0 ? att.size : att.content.length;
    if (size > MAX_EMAIL_ATTACHMENT_BYTES) continue;
    if (isImage(mime) && size < MIN_IMAGE_ATTACHMENT_BYTES) continue; // stray logo/pixel

    const filename = safeAttachmentName(att.filename, mime);
    const key = `${filename.toLowerCase()}::${size}`;
    if (seen.has(key)) continue; // same file twice in one email
    seen.add(key);

    out.push({ filename, contentType: mime, content: att.content, size });
  }

  return out;
}

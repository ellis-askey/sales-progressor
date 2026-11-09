// Store the attachments an agent sends on a composed email into the file's
// Documents, and return lightweight metadata for the timeline. Sent attachments
// were previously dropped entirely — they reached the recipient but left no
// record on the file (critique #287). Mirrors the inbound filing policy (same
// allow-list, size cap, name-cleaning, dedup) with source "email_sent".

import { prisma } from "@/lib/prisma";
import { uploadToStorage } from "@/lib/supabase-storage";
import { buildDocumentStoragePath } from "@/lib/upload/document-upload";
import {
  EMAIL_ATTACHMENT_ALLOWED_MIME,
  MAX_EMAIL_ATTACHMENT_BYTES,
  safeAttachmentName,
} from "./attachments";

// What the timeline needs to render a "📎 filename" marker on the sent email.
export type EmailAttachmentMeta = { filename: string; size: number };

// The composer hands attachments as base64. Shared by send-now (compose.ts) and
// the scheduled drain (outboundQueue.ts).
export type Base64Attachment = { filename: string; type: string; contentBase64: string };

export async function storeOutboundEmailAttachments(
  transactionId: string,
  attachments: Base64Attachment[] | undefined,
  uploadedById: string | null,
): Promise<EmailAttachmentMeta[]> {
  if (!attachments?.length) return [];
  const meta: EmailAttachmentMeta[] = [];
  const seen = new Set<string>();

  for (const att of attachments) {
    const mime = (att.type || "").split(";")[0]!.trim().toLowerCase();
    // Same allow-list as inbound: file the document types that belong on a
    // conveyancing file; anything else still reached the recipient, it just
    // isn't filed (and so isn't marked).
    if (!EMAIL_ATTACHMENT_ALLOWED_MIME.has(mime)) continue;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(att.contentBase64, "base64");
    } catch {
      continue;
    }
    const size = buffer.length;
    if (size === 0 || size > MAX_EMAIL_ATTACHMENT_BYTES) continue;

    const filename = safeAttachmentName(att.filename, mime);
    const key = `${filename.toLowerCase()}::${size}`;
    if (seen.has(key)) continue; // same file twice on one email
    seen.add(key);
    // Mark it on the timeline whether or not it's a fresh upload (the dedup
    // below skips re-filing a document the property already holds, not the row).
    meta.push({ filename, size });

    try {
      const dupe = await prisma.transactionDocument.findFirst({
        where: { transactionId, filename, fileSize: size },
        select: { id: true },
      });
      if (dupe) continue;
      const storagePath = buildDocumentStoragePath(transactionId, filename);
      await uploadToStorage(storagePath, buffer, mime);
      await prisma.transactionDocument.create({
        data: {
          transactionId,
          filename,
          storagePath,
          fileSize: size,
          mimeType: mime,
          source: "email_sent",
          uploadedById,
          contactId: null,
        },
      });
    } catch (err) {
      console.error(
        `[compose] attachment store failed (${filename}) on ${transactionId}:`,
        (err as Error).message,
      );
    }
  }

  return meta;
}

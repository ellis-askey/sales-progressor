// Client-side direct-to-storage upload (2026-08-21). See lib/upload/document
// -upload.ts for why this exists. Three steps: mint a signed URL from our
// server, PUT the file straight to Supabase, then finalize (record the row).
// Shared by every document uploader (portal + agent) so the flow stays
// identical everywhere.

import { MAX_DOCUMENT_BYTES, formatBytes } from "./document-upload";

export type DirectUploadResult<T = unknown> =
  | { ok: true; document: T }
  | { ok: false; error: string };

async function readError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  return json?.error ?? "Upload failed. Please try again.";
}

/**
 * Upload a single document directly to storage.
 * @param file      the file to upload
 * @param mintUrl   endpoint that returns { uploadUrl, storagePath } (include ?token= for portal)
 * @param finalizeUrl endpoint that records the document (include ?token= for portal)
 * @param docType   the chosen document taxonomy key (or null)
 */
export async function uploadDocumentDirect<T = unknown>(opts: {
  file: File;
  mintUrl: string;
  finalizeUrl: string;
  docType: string | null;
}): Promise<DirectUploadResult<T>> {
  const { file, mintUrl, finalizeUrl, docType } = opts;

  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: `That file is ${formatBytes(file.size)}. Please upload one under 25 MB.` };
  }
  const contentType = file.type || "application/octet-stream";

  // 1. Mint a one-time signed upload URL.
  const mintRes = await fetch(mintUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType, size: file.size, docType }),
  });
  if (!mintRes.ok) return { ok: false, error: await readError(mintRes) };
  const { uploadUrl, storagePath } = (await mintRes.json()) as { uploadUrl: string; storagePath: string };

  // 2. Send the bytes straight to storage — bypasses the serverless body cap.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType, "x-upsert": "false" },
    body: file,
  });
  if (!put.ok) {
    // Supabase returns 413 when the file exceeds the bucket's own limit.
    if (put.status === 413) return { ok: false, error: "That file is too large. Please upload one under 25 MB." };
    return { ok: false, error: "We couldn't upload that file. Please try again." };
  }

  // 3. Record the document against the file.
  const finRes = await fetch(finalizeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storagePath,
      filename: file.name,
      fileSize: file.size,
      mimeType: contentType,
      docType,
    }),
  });
  if (!finRes.ok) return { ok: false, error: await readError(finRes) };
  return { ok: true, document: (await finRes.json()) as T };
}

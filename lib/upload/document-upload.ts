// Shared document-upload rules (2026-08-21).
//
// Document uploads (portal + agent) go DIRECT to Supabase Storage rather than
// through our own serverless function. Vercel caps anything routed through a
// function body at ~4.5 MB, so large PDFs (surveys, TA6/TA10/TA13, searches)
// used to fail before our own 10 MB check even ran. The new flow: the browser
// asks the server to mint a one-time signed upload URL, PUTs the file straight
// to storage, then tells the server to record it. That lifts the ceiling to the
// bucket's own limit (set to 25 MB), so this module is the single source of
// truth for what's allowed — shared by the mint endpoints, the finalize
// endpoints, and the client-side upload helper.

export const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_UPLOAD_FILES = 3;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Where an uploaded document lands in the bucket. Always under the transaction's
// own prefix so the finalize step can prove the file belongs to the caller's
// file before recording it.
export function buildDocumentStoragePath(transactionId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${transactionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export type MintRequest = { filename: string; contentType: string; size: number };

// Validates a mint request BEFORE we hand out a signed upload URL. Returns a
// human-facing message when the request is rejected, or null when it's fine.
export function validateUploadRequest(m: MintRequest): string | null {
  if (!m.filename || typeof m.filename !== "string") return "A file name is required.";
  if (!ALLOWED_UPLOAD_MIME.has(m.contentType)) {
    return "That file type isn't supported. Please upload a PDF, image or Word document.";
  }
  if (!Number.isFinite(m.size) || m.size <= 0) return "That file looks empty. Please try another.";
  if (m.size > MAX_DOCUMENT_BYTES) {
    return `That file is ${formatBytes(m.size)}. Please upload one under 25 MB.`;
  }
  return null;
}

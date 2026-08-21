// Client-side image prep for photo uploads (2026-08-21).
//
// Why this exists: agents shoot property photos on their phones, where a
// single JPEG is routinely 4-12 MB. Vercel caps a serverless request body
// at ~4.5 MB, so anything bigger is rejected by the platform with a plain
// "Request Entity Too Large" 413 BEFORE our route runs — which used to crash
// the client with "Unexpected token 'R'... is not valid JSON".
//
// The fix is to shrink the image in the browser first. A property photo only
// ever renders as a small hero/thumbnail, so downscaling the longest edge to
// ~2000px and re-encoding as JPEG turns a 6 MB photo into a few hundred KB —
// well under the limit, and faster to load everywhere it's shown.
//
// Anything the browser can't decode (e.g. HEIC in Chrome, which has no
// built-in HEIC decoder) is passed through untouched; the size guard in the
// caller catches the rare case where such a file is also too big.

const DEFAULT_MAX_EDGE = 2000;
const DEFAULT_QUALITY = 0.85;
// Only bother re-encoding when the original is above this; small, already-web
// -sized images upload fine as-is and re-encoding would just lose quality.
const REENCODE_ABOVE_BYTES = 1_000_000;

// Platform-safe ceiling for a raw (un-shrunk) upload. Vercel's serverless
// body limit is ~4.5 MB; we stop a touch below to leave room for multipart
// overhead. Kept here so the caller's guard and message stay in step.
export const SAFE_UPLOAD_BYTES = 4 * 1024 * 1024;

export type PreparedImage = {
  file: File;
  // True when we successfully shrank/re-encoded the image. False means the
  // original is being returned unchanged (already small, or undecodable).
  reencoded: boolean;
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Shrink an oversized image for upload. Returns the (possibly re-encoded)
 * file plus whether we managed to shrink it. Never throws — on any failure
 * it falls back to the original file so the caller can still try to upload.
 */
export async function prepareImageForUpload(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<PreparedImage> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  // Not an image, or already small enough that re-encoding buys nothing.
  if (!file.type.startsWith("image/") || file.size <= REENCODE_ABOVE_BYTES) {
    return { file, reencoded: false };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    // createImageBitmap decodes JPEG/PNG/WEBP in every modern browser, and
    // HEIC only where the OS/browser supports it (e.g. Safari). Where it
    // can't decode (HEIC in Chrome), it throws and we fall through to the
    // original file untouched.
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, reencoded: false };
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, reencoded: false };
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, quality);
    if (!blob) return { file, reencoded: false };

    // If re-encoding somehow produced a larger file (already-compressed
    // small source), keep the original.
    if (blob.size >= file.size) return { file, reencoded: false };

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    const shrunk = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
    return { file: shrunk, reencoded: true };
  } catch {
    return { file, reencoded: false };
  } finally {
    bitmap.close();
  }
}

/**
 * Turn a failed upload Response into a clean, human message — never the raw
 * body. Reads our own JSON `{ error }` first, then maps status codes.
 */
export async function describeUploadError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Non-JSON body (e.g. a platform 413 in plain text) — fall through to
    // the status-based messages below.
  }
  if (res.status === 413) {
    return "That image is too large to upload. Please use one under 4 MB.";
  }
  if (res.status === 401 || res.status === 403) {
    return "You do not have permission to do that. Please sign in again.";
  }
  return "We couldn't upload that photo. Please try again.";
}

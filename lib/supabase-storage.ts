import { createClient } from "@supabase/supabase-js";

const BUCKET = "transaction-documents";

// Public bucket for provider (surveyor / electrician / etc.) logos. Set to
// public read in the Supabase dashboard so the client-facing /quote/[token]
// page can render them without a per-render signed-URL round trip.
// See docs/active/ELLIS_MANUAL_TODO.md for the bucket creation step.
export const PROVIDER_LOGOS_BUCKET = "provider-logos";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
    throw new Error("Supabase storage not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env");
  }
  return createClient(url, key);
}

export async function uploadToStorage(
  path: string,
  buffer: Buffer,
  mimeType: string,
  options: { upsert?: boolean } = {},
): Promise<string> {
  const client = getClient();
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: options.upsert ?? false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

// Mint a one-time signed upload URL so the browser can PUT a file straight to
// storage, bypassing the serverless request-body cap. See lib/upload/document
// -upload.ts. The returned uploadUrl is token-authorised — the browser needs no
// Supabase key. Paired with storageObjectExists() at finalize time.
export async function createDocumentUploadUrl(
  path: string,
): Promise<{ uploadUrl: string; path: string }> {
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Failed to create upload URL: ${error?.message}`);
  return { uploadUrl: data.signedUrl, path: data.path };
}

// Confirms an object actually landed in the bucket before we record a DB row
// for it — guards against a finalize call for a PUT that never completed.
export async function storageObjectExists(path: string): Promise<boolean> {
  const client = getClient();
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  const { data, error } = await client.storage.from(BUCKET).list(folder, { search: name, limit: 100 });
  if (error || !data) return false;
  return data.some((o) => o.name === name);
}

// Lists the `property-photos/` folder and returns the set of transaction IDs
// that actually have an uploaded image (filename is `{transactionId}.{ext}`).
// Used by the Command Centre Files view to detect drift: a file can have an
// image in storage while its DB photoStoragePath was never persisted (the agent
// upload is a two-step flow). Degrades to an empty set if storage is
// unconfigured or errors, so callers simply fall back to the DB field.
// Returns a map of transactionId -> full storage path for every image in the
// `property-photos/` folder. Degrades to an empty map on any storage error.
export async function listStoredPhotos(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const client = getClient();
    const pageSize = 1000;
    let offset = 0;
    for (let page = 0; page < 25; page++) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .list("property-photos", { limit: pageSize, offset });
      if (error || !data || data.length === 0) break;
      for (const o of data) {
        const dot = o.name.lastIndexOf(".");
        const id = dot === -1 ? o.name : o.name.slice(0, dot);
        if (id) map.set(id, `property-photos/${o.name}`);
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  } catch {
    // storage unconfigured / transient error — caller falls back to DB field
  }
  return map;
}

export async function listStoredPhotoTxIds(): Promise<Set<string>> {
  return new Set((await listStoredPhotos()).keys());
}

export function getStorageUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/sign/${BUCKET}/${path}`;
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteFromStorage(path: string): Promise<void> {
  const client = getClient();
  await client.storage.from(BUCKET).remove([path]);
}

// Batch-sign many storage paths in ONE round trip (Supabase createSignedUrls).
// Returns a path → signed-URL map; paths that fail to sign are simply absent,
// so callers fall back to their no-photo state. Null/undefined/duplicate
// inputs are tolerated — used by the hub attention card, which decorates
// rows from five different queries with property-photo thumbnails.
export async function getSignedUrlMap(
  paths: Array<string | null | undefined>,
  expiresInSeconds = 3600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map();
  try {
    const client = getClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrls(unique, expiresInSeconds);
    if (error || !data) return new Map();
    const map = new Map<string, string>();
    for (const row of data) {
      if (row.signedUrl && row.path) map.set(row.path, row.signedUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Provider logos (public bucket) ──────────────────────────────────────────
// Separate helpers because the bucket is public-read, so we serve a permanent
// public URL rather than signing per render. Called from the Command Centre
// firm-edit form (upload/delete) and every render that shows a provider logo.

export async function uploadProviderLogo(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const { error } = await client.storage
    .from(PROVIDER_LOGOS_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Provider logo upload failed: ${error.message}`);
  return path;
}

export function getProviderLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${PROVIDER_LOGOS_BUCKET}/${path}`;
}

export async function deleteProviderLogo(path: string): Promise<void> {
  const client = getClient();
  await client.storage.from(PROVIDER_LOGOS_BUCKET).remove([path]);
}

// ── Agency logos (public bucket) ────────────────────────────────────────────
// A customer agency's own logo, shown in client-facing emails. Public-read so
// email clients can fetch it via a permanent URL (signed URLs would expire before
// an email is opened). Path is `{agencyId}.{ext}` (upsert). Bucket creation is a
// manual step — see docs/active/ELLIS_MANUAL_TODO.md.
export const AGENCY_LOGOS_BUCKET = "agency-logos";

export async function uploadAgencyLogo(path: string, buffer: Buffer, mimeType: string): Promise<string> {
  const client = getClient();
  const { error } = await client.storage
    .from(AGENCY_LOGOS_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Agency logo upload failed: ${error.message}`);
  return path;
}

export function getAgencyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${AGENCY_LOGOS_BUCKET}/${path}`;
}

export async function deleteAgencyLogo(path: string): Promise<void> {
  const client = getClient();
  await client.storage.from(AGENCY_LOGOS_BUCKET).remove([path]);
}

// ── Staff avatars (public bucket) ────────────────────────────────────────────
// Internal-staff / agent profile photos. Public-read like provider logos so
// the buyer/seller portal and every "who did it" surface can render them
// without a signed-URL round trip. Path is `{userId}.{ext}` (upsert), and the
// full public URL is stored on User.image. Bucket created in staging
// 2026-08-12; see docs/active/ELLIS_MANUAL_TODO.md for the prod step.
export const AVATARS_BUCKET = "avatars";

export async function uploadAvatar(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const { error } = await client.storage
    .from(AVATARS_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Avatar upload failed: ${error.message}`);
  return path;
}

export function getAvatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
}

export async function deleteAvatar(path: string): Promise<void> {
  const client = getClient();
  await client.storage.from(AVATARS_BUCKET).remove([path]);
}

// ── WhatsApp media (private bucket) ──────────────────────────────────────────
// Client WhatsApp attachments (images / PDFs / voice notes / video). PRIVATE
// like transaction-documents (can contain sensitive survey/enquiry content), so
// we store the object path on OutboundMessage.mediaUrl and sign per render.
// Bucket created in Supabase; see docs/active/ELLIS_MANUAL_TODO.md.
export const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";

export async function uploadWhatsAppMedia(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const { error } = await client.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`WhatsApp media upload failed: ${error.message}`);
  return path;
}

// Batch-sign WhatsApp media paths in one round trip (path → signed URL). Absent
// entries fall back to no-media rendering. Mirrors getSignedUrlMap but for the
// whatsapp-media bucket.
export async function getWhatsAppMediaSignedUrlMap(
  paths: Array<string | null | undefined>,
  expiresInSeconds = 3600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map();
  try {
    const client = getClient();
    const { data, error } = await client.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrls(unique, expiresInSeconds);
    if (error || !data) return new Map();
    const map = new Map<string, string>();
    for (const row of data) {
      if (row.signedUrl && row.path) map.set(row.path, row.signedUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

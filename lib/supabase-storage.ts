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

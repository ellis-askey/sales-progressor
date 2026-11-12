import { createClient } from "@supabase/supabase-js";

// Storage for Platform Update screenshots. Own PRIVATE bucket, never public:
// unpublished drafts (and their images) must not be reachable by ordinary
// agents, so images are only ever served through a short-lived signed URL
// generated server-side for the superadmin Command Centre (Phase 1). The agent
// read-path (Phase 2) will sign its own URLs server-side too. Command-only
// (Law 8). Mirrors lib/command/critique-storage.ts.
//
// The bucket is created automatically on first use so there is no manual
// provisioning step to forget. Images upload straight from the browser via a
// signed upload URL, bypassing the ~4.5 MB serverless request-body limit.
export const PLATFORM_UPDATE_BUCKET = "platform-update-images";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
    throw new Error("Supabase storage not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env");
  }
  return createClient(url, key);
}

// Create the bucket if absent (PRIVATE). Idempotent and cheap.
let ensured = false;
export async function ensurePlatformUpdateBucket(): Promise<void> {
  if (ensured) return;
  try {
    const sb = client();
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === PLATFORM_UPDATE_BUCKET)) {
      await sb.storage.createBucket(PLATFORM_UPDATE_BUCKET, { public: false });
    }
    ensured = true;
  } catch {
    /* leave ensured=false so a later call retries */
  }
}

/** Mint a one-time signed upload URL so the browser PUTs the image straight to
 *  storage. Ensures the bucket exists first. Returns null if it can't be minted. */
export async function createPlatformUpdateUploadUrl(path: string): Promise<{ uploadUrl: string; path: string } | null> {
  try {
    await ensurePlatformUpdateBucket();
    const { data, error } = await client().storage.from(PLATFORM_UPDATE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return null;
    return { uploadUrl: data.signedUrl, path: data.path };
  } catch {
    return null;
  }
}

/** Confirm an object actually landed before we record its path on the update. */
export async function platformUpdateObjectExists(path: string): Promise<boolean> {
  try {
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const { data } = await client().storage.from(PLATFORM_UPDATE_BUCKET).list(folder, { search: name, limit: 100 });
    return !!data?.some((o) => o.name === name);
  } catch {
    return false;
  }
}

/** Signed read URL for a stored image (default 1h), null if it can't sign. */
export async function getPlatformUpdateSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  try {
    const { data } = await client().storage.from(PLATFORM_UPDATE_BUCKET).createSignedUrl(path, expiresInSeconds);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Remove a stored image (best-effort), e.g. when the image is replaced/cleared
 *  or the update is deleted. */
export async function deletePlatformUpdateObject(path: string): Promise<void> {
  try {
    await client().storage.from(PLATFORM_UPDATE_BUCKET).remove([path]);
  } catch {
    /* best-effort */
  }
}

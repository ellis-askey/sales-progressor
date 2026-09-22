import { createClient } from "@supabase/supabase-js";

// Storage for founder Critique screenshots. Own PRIVATE bucket, kept apart from
// the real-feedback bucket so the two never share objects. Command-only (Law 8).
//
// The bucket is created automatically on first use (ensureCritiqueBucket) so
// there is no manual provisioning step to forget — the earlier "no screenshots"
// failure was a missing hand-created bucket. Screenshots upload straight from
// the browser via a signed upload URL (createCritiqueUploadUrl), bypassing the
// ~4.5 MB serverless request-body limit that was dropping large desktop shots.
export const CRITIQUE_BUCKET = "critique-screenshots";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
    throw new Error("Supabase storage not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env");
  }
  return createClient(url, key);
}

// Create the bucket if it doesn't exist yet (private). Idempotent and cheap:
// one list call, then create only when absent. Errors are swallowed — if the
// bucket genuinely can't be provisioned the caller's mint/PUT will surface it.
let ensured = false;
export async function ensureCritiqueBucket(): Promise<void> {
  if (ensured) return;
  try {
    const sb = client();
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === CRITIQUE_BUCKET)) {
      await sb.storage.createBucket(CRITIQUE_BUCKET, { public: false });
    }
    ensured = true;
  } catch {
    /* leave ensured=false so a later call retries */
  }
}

/** Mint a one-time signed upload URL so the browser PUTs the PNG straight to
 *  storage (no base64 through our serverless function). Ensures the bucket
 *  exists first. Returns null if it can't be minted. */
export async function createCritiqueUploadUrl(path: string): Promise<{ uploadUrl: string; path: string } | null> {
  try {
    await ensureCritiqueBucket();
    const { data, error } = await client().storage.from(CRITIQUE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return null;
    return { uploadUrl: data.signedUrl, path: data.path };
  } catch {
    return null;
  }
}

/** Confirm an object actually landed before we record its path on the note. */
export async function critiqueObjectExists(path: string): Promise<boolean> {
  try {
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const { data } = await client().storage.from(CRITIQUE_BUCKET).list(folder, { search: name, limit: 100 });
    return !!data?.some((o) => o.name === name);
  } catch {
    return false;
  }
}

/** Signed read URL for a stored screenshot (default 1h), null if it can't sign. */
export async function getCritiqueSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  try {
    const { data } = await client().storage.from(CRITIQUE_BUCKET).createSignedUrl(path, expiresInSeconds);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

import { createClient } from "@supabase/supabase-js";

// Storage for founder Critique screenshots. Own PRIVATE bucket, kept apart from
// the real-feedback bucket so the two never share objects. Mirrors the upload /
// signed-URL pattern the feedback route already uses (app/api/feedback), but
// scoped to this bucket. Command-only (Law 8) — imported by the /api/command
// route and the Command Centre review page.
//
// The bucket must be created in each Supabase project (staging + prod) as a
// PRIVATE bucket — see docs/active/ELLIS_MANUAL_TODO.md.
export const CRITIQUE_BUCKET = "critique-screenshots";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
    throw new Error("Supabase storage not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env");
  }
  return createClient(url, key);
}

/** Upload a base64 PNG, returning the stored object path (null on failure). */
export async function uploadCritiqueScreenshot(base64: string, filename: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64, "base64");
    const safe = filename.toLowerCase().endsWith(".png") ? filename : `${filename}.png`;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
    const { error } = await client().storage.from(CRITIQUE_BUCKET).upload(path, buffer, { contentType: "image/png" });
    if (error) return null;
    return path;
  } catch {
    return null;
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

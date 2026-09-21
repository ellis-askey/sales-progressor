import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { uploadCritiqueScreenshot } from "@/lib/command/critique-storage";

// Founder "Critique" capture — superadmin-only. Saves a note + optional
// screenshot to its OWN table (CritiqueNote), reviewed in the Command Centre.
// Deliberately fire-and-forget: unlike real feedback (/api/feedback), it sends
// NO email/notification. commandDb is a full-access client, so the superadmin
// guard lives here (Law 7 / Law 8).

// A full-page PNG can be a couple of MB as base64 — keep a sane ceiling.
const MAX_BASE64 = 8_000_000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let payload: {
    body?: string;
    screenshotBase64?: string | null;
    screenshotFilename?: string | null;
    pageUrl?: string | null;
    viewportSize?: string | null;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const body = (payload.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "Empty note" }, { status: 400 });

  // Upload the screenshot if one came through (best-effort — a failed capture
  // must never lose the note, so we still save the row without a screenshot).
  let screenshotPath: string | null = null;
  let screenshotFilename: string | null = null;
  if (payload.screenshotBase64 && payload.screenshotFilename) {
    if (payload.screenshotBase64.length > MAX_BASE64) {
      return NextResponse.json({ error: "Screenshot too large" }, { status: 413 });
    }
    screenshotPath = await uploadCritiqueScreenshot(payload.screenshotBase64, payload.screenshotFilename);
    if (screenshotPath) screenshotFilename = payload.screenshotFilename;
  }

  await commandDb.critiqueNote.create({
    data: {
      body,
      screenshotPath,
      screenshotFilename,
      pageUrl: payload.pageUrl?.slice(0, 2000) ?? null,
      viewportSize: payload.viewportSize?.slice(0, 32) ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

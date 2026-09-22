import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { createCritiqueUploadUrl, critiqueObjectExists } from "@/lib/command/critique-storage";

// Founder "Critique" capture — superadmin-only. Decoupled from the screenshot so
// a note is NEVER lost:
//   POST  → save the note immediately (tiny body) + mint a signed upload URL so
//           the browser PUTs the PNG straight to storage (past the ~4.5 MB
//           serverless body limit that used to drop big desktop shots).
//   PATCH → attach the uploaded screenshot's path to the note.
// Its own table + bucket, and NO email (unlike real feedback). commandDb is a
// full-access client, so the superadmin guard lives here (Law 7 / Law 8).

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let payload: { body?: string; pageUrl?: string | null; viewportSize?: string | null; wantsScreenshot?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const body = (payload.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "Empty note" }, { status: 400 });

  // Save the note first — this is the important part and must not depend on the
  // screenshot succeeding.
  const note = await commandDb.critiqueNote.create({
    data: {
      body,
      pageUrl: payload.pageUrl?.slice(0, 2000) ?? null,
      viewportSize: payload.viewportSize?.slice(0, 32) ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
    },
  });

  // Mint an upload URL for the browser to PUT the screenshot into (best-effort —
  // if it can't be minted the note still stands, just without an image).
  let upload: { uploadUrl: string; path: string } | null = null;
  if (payload.wantsScreenshot) {
    upload = await createCritiqueUploadUrl(`${note.id}/${Date.now()}.png`);
  }

  return NextResponse.json({ id: note.id, uploadUrl: upload?.uploadUrl ?? null, path: upload?.path ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let payload: { id?: string; path?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { id, path } = payload;
  if (!id || !path) return NextResponse.json({ error: "Missing id or path" }, { status: 400 });

  // Confirm the object really landed before recording it, so a broken PUT never
  // leaves a note pointing at a missing screenshot.
  if (!(await critiqueObjectExists(path))) {
    return NextResponse.json({ error: "Screenshot not found in storage" }, { status: 409 });
  }

  await commandDb.critiqueNote.update({
    where: { id },
    data: { screenshotPath: path, screenshotFilename: path.split("/").pop() ?? "critique.png" },
  });

  return NextResponse.json({ ok: true });
}

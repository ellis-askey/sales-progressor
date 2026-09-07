// POST /api/agent/signature-image
//
// Two setup methods for the ONE "Signature image" option:
//   - multipart form { file }           → upload a signature image
//   - JSON { url }                      → import an already-hosted image
//
// Both converge to the same place: the image is stored in our public
// `signatures` bucket at `{userId}.{ext}` (upsert), User.emailSignatureImagePath
// is set, and the mode is switched to IMAGE. Importing (rather than hotlinking)
// protects recipient privacy and survives the remote image disappearing.
// Returns { url, mode }.
//
// DELETE clears the image and reverts the mode to BASIC.
//
// Validation: session required; image mime only; under 2 MB; URL must be https.
// See docs/active/email-signature/00-audit-and-plan.md §5 / §11.

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadSignatureImage, getSignatureImageUrl, deleteSignatureImage } from "@/lib/supabase-storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "jpg";
  }
}

async function persist(userId: string, buffer: Buffer, mime: string) {
  const path = `${userId}.${extFor(mime)}`;
  await uploadSignatureImage(path, buffer, mime);
  const base = getSignatureImageUrl(path);
  await prisma.user.update({
    where: { id: userId },
    data: { emailSignatureImagePath: path, emailSignatureMode: "IMAGE" },
  });
  return base ? `${base}?v=${Date.now()}` : null;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const contentType = req.headers.get("content-type") ?? "";

  // ── Import from URL ──────────────────────────────────────────────────────
  if (contentType.includes("application/json")) {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !/^https:\/\//i.test(url)) {
      return NextResponse.json({ error: "Enter an https image URL." }, { status: 400 });
    }
    let remote: Response;
    try {
      remote = await fetch(url, { redirect: "follow" });
    } catch {
      return NextResponse.json({ error: "We couldn't fetch that image. Check the link." }, { status: 400 });
    }
    if (!remote.ok) {
      return NextResponse.json({ error: "That image link didn't load." }, { status: 400 });
    }
    const mime = (remote.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json({ error: "That link isn't a JPG, PNG, WEBP or GIF image." }, { status: 400 });
    }
    const bytes = await remote.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "That image is too large. Max 2 MB." }, { status: 400 });
    }
    const savedUrl = await persist(session.user.id, Buffer.from(bytes), mime);
    return NextResponse.json({ url: savedUrl, mode: "IMAGE" });
  }

  // ── Direct upload ────────────────────────────────────────────────────────
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Max 2 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP or GIF image." }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const savedUrl = await persist(session.user.id, Buffer.from(bytes), file.type);
  return NextResponse.json({ url: savedUrl, mode: "IMAGE" });
}

export async function DELETE() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailSignatureImagePath: true },
  });
  if (user?.emailSignatureImagePath) {
    await deleteSignatureImage(user.emailSignatureImagePath).catch(() => {});
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailSignatureImagePath: null, emailSignatureMode: "BASIC" },
  });
  return NextResponse.json({ ok: true, mode: "BASIC" });
}

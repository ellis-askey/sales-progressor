// POST /api/agent/upload-avatar
//
// Multipart form: field = { file }. Returns { url }.
//
// Uploads the caller's profile photo to the public `avatars` bucket at
// `{userId}.{ext}` (upsert), then stores the full public URL (cache-busted)
// on User.image. Every "who did it" surface reads User.image, so a fresh
// upload shows everywhere on the next render.
//
// DELETE /api/agent/upload-avatar clears User.image (back to the default
// avatar). The stored file is left in place; the next upload upserts over it.
//
// Validation: session required; image mime only; under 5 MB.

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadAvatar, getAvatarPublicUrl } from "@/lib/supabase-storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Max 5 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WEBP image." }, { status: 400 });
  }

  const path = `${session.user.id}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadAvatar(path, Buffer.from(bytes), file.type);

  // Cache-bust so a re-upload to the same path shows immediately.
  const base = getAvatarPublicUrl(path);
  const url = base ? `${base}?v=${Date.now()}` : null;
  await prisma.user.update({ where: { id: session.user.id }, data: { image: url } });

  return NextResponse.json({ url });
}

export async function DELETE() {
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.user.id }, data: { image: null } });
  return NextResponse.json({ ok: true });
}

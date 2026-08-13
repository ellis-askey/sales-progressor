// POST /api/portal/[token]/upload-avatar
//
// Multipart form: field = { file }. Returns { url }.
//
// The client's own profile photo, set from the portal menu. Auth is the
// portal token itself (same model as the rest of the portal) — only the
// holder of a contact's token can set that contact's photo. Uploads to the
// public `avatars` bucket at `contact-{contactId}.{ext}` (upsert), then
// stores the cache-busted public URL on Contact.image. Every "who did it"
// surface that reads Contact.image (bell, Updates feed, notes, portal) then
// shows the real face on the next render. Mirrors the agent avatar route.
//
// Validation: valid token; image mime only; under 5 MB.

import { type NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!contact) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

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

  const path = `contact-${contact.id}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadAvatar(path, Buffer.from(bytes), file.type);

  // Cache-bust so a re-upload to the same path shows immediately.
  const base = getAvatarPublicUrl(path);
  const url = base ? `${base}?v=${Date.now()}` : null;
  await prisma.contact.update({ where: { id: contact.id }, data: { image: url } });

  return NextResponse.json({ url });
}

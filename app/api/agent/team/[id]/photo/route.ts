// POST /api/agent/team/[id]/photo — a director sets a team member's display
// photo. DELETE removes it. Director-only, and the target must be a negotiator
// in the director's own agency. Mirrors the profile-avatar storage flow
// (public `avatars` bucket, {userId}.{ext} upsert, cache-busted) but scoped to
// the agency rather than the founder's Command Centre tool.

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

async function requireDirectorForMember(id: string) {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { error: NextResponse.json({ error: "Director access required" }, { status: 403 }) };
  }
  const target = await prisma.user.findFirst({
    where: { id, agencyId: session.user.agencyId, role: "negotiator" },
    select: { id: true },
  });
  if (!target) {
    return { error: NextResponse.json({ error: "Negotiator not found" }, { status: 404 }) };
  }
  return { error: null };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { error } = await requireDirectorForMember(id);
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large. Max 5 MB." }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WEBP image." }, { status: 400 });
  }

  const path = `${id}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadAvatar(path, Buffer.from(bytes), file.type);

  const base = getAvatarPublicUrl(path);
  const url = base ? `${base}?v=${Date.now()}` : null;
  // A fresh photo resets the focal point to centre.
  await prisma.user.update({ where: { id }, data: { image: url, imageFocusX: 50, imageFocusY: 50 } });

  return NextResponse.json({ url });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { error } = await requireDirectorForMember(id);
  if (error) return error;

  await prisma.user.update({ where: { id }, data: { image: null } });
  return NextResponse.json({ ok: true });
}

// POST /api/command/agents/[userId]/photo  (superadmin — Command Centre)
//
// Multipart: { file }. Uploads a profile photo for any agent and sets it on
// User.image, so it shows everywhere that surface reads (bell, comms feed,
// team lists, Command Centre). Founder-set from the agent drill-down. Uploads
// to the public `avatars` bucket at `{userId}.{ext}` (upsert), cache-busted.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { userId } = await ctx.params;

  const user = await commandDb.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large. Max 5 MB." }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WEBP image." }, { status: 400 });
  }

  const path = `${userId}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadAvatar(path, Buffer.from(bytes), file.type);

  const base = getAvatarPublicUrl(path);
  const url = base ? `${base}?v=${Date.now()}` : null;
  // A fresh photo resets the focal point to centre — the old point rarely
  // suits a different crop.
  await commandDb.user.update({ where: { id: userId }, data: { image: url, imageFocusX: 50, imageFocusY: 50 } });

  return NextResponse.json({ url });
}

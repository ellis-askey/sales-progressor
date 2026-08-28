// POST /s/[token]/avatar — the solicitor handler's profile photo.
//
// Multipart form: field = { file }. Returns { url }. Auth is the signed
// solicitor token; only the holder of a (file, side) link can set that side's
// handler photo. Uploads to the public avatars bucket and stores the
// cache-busted URL on SolicitorContact.image, so the Updates feed shows the
// real face on the next render. Mirrors the client portal avatar route.

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadAvatar, getAvatarPublicUrl } from "@/lib/supabase-storage";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";

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
  const decoded = verifySolicitorToken(token);
  if (!decoded) return NextResponse.json({ error: "invalid link" }, { status: 401 });

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: { vendorSolicitorContactId: true, purchaserSolicitorContactId: true },
  });
  const contactId = decoded.side === "vendor" ? tx?.vendorSolicitorContactId : tx?.purchaserSolicitorContactId;
  if (!contactId) return NextResponse.json({ error: "no handler on file" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large. Max 5 MB." }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WEBP image." }, { status: 400 });

  const path = `solicitor-${contactId}.${extFor(file.type)}`;
  await uploadAvatar(path, Buffer.from(await file.arrayBuffer()), file.type);
  const base = getAvatarPublicUrl(path);
  const url = base ? `${base}?v=${Date.now()}` : null;
  await prisma.solicitorContact.update({ where: { id: contactId }, data: { image: url } });

  return NextResponse.json({ url });
}

// POST /api/command/files/photo  (superadmin only — Command Centre → Files)
//
// Multipart: { transactionId, file }. Uploads the property photo and sets it on
// the file, so it becomes the hero image everywhere the file is shown — the
// client portal, the chain drawer, etc. The founder can add a missing photo
// straight from the Files tab without opening each file.
//
// Sets photoStoragePath + photoUploadedAt (the same fields the agent upload
// writes), so display code is unchanged. Old photo at a different extension is
// cleaned up. Returns { url } (signed, for an instant preview).

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { uploadToStorage, getSignedUrl, deleteFromStorage } from "@/lib/supabase-storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    default: return "jpg";
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const form = await req.formData();
  const transactionId = String(form.get("transactionId") ?? "");
  const file = form.get("file");
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is too large. Max 8 MB." }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "File must be an image (JPG, PNG, WEBP, HEIC)." }, { status: 400 });
  }

  const existing = await commandDb.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { id: true, photoStoragePath: true },
  });
  if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const path = `property-photos/${transactionId}.${extFor(file.type)}`;
  const bytes = await file.arrayBuffer();
  await uploadToStorage(path, Buffer.from(bytes), file.type, { upsert: true });

  // Clean up a previous photo stored at a different extension (a same-ext
  // re-upload just overwrote it above).
  if (existing.photoStoragePath && existing.photoStoragePath !== path) {
    await deleteFromStorage(existing.photoStoragePath).catch(() => {});
  }

  await commandDb.propertyTransaction.update({
    where: { id: transactionId },
    data: { photoStoragePath: path, photoUploadedAt: new Date() },
  });

  const url = await getSignedUrl(path).catch(() => null);
  return NextResponse.json({ ok: true, url });
}

// POST /api/agent/upload-property-photo
//
// Multipart form: fields = { transactionId, file }.
// Returns { storagePath, url }.
//
// Uploads the file to Supabase Storage under
// `property-photos/{transactionId}.{ext}` with upsert=true (re-uploads
// overwrite). Caller then calls setPropertyPhotoAction with the returned
// storagePath to persist the reference on the PropertyTransaction row.
//
// Validation:
//   - session required
//   - transaction must exist within caller's access scope
//   - file must be an image (image/* mime)
//   - file must be under 8 MB (agents shoot on phones — this is generous)

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { uploadToStorage, getSignedUrl } from "@/lib/supabase-storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function extFor(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    default: return "jpg";
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const form = await req.formData();
  const transactionId = String(form.get("transactionId") ?? "");
  const file = form.get("file");
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large. Max 8 MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "File must be an image (JPG, PNG, WEBP, HEIC)." }, { status: 400 });
  }

  // Ownership check: caller must be able to see this transaction under
  // their access scope.
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const ext = extFor(file.type);
  const path = `property-photos/${transactionId}.${ext}`;
  const bytes = await file.arrayBuffer();
  await uploadToStorage(path, Buffer.from(bytes), file.type, { upsert: true });

  // Return a signed URL so the client can preview the upload straight away
  // without a page refresh. Fresh URLs are minted each render on the actual
  // display pages so 1h expiry here is fine.
  const url = await getSignedUrl(path);
  return NextResponse.json({ storagePath: path, url });
}

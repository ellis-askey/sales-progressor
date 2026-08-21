// POST /api/portal/documents/upload-url
// Mints a one-time signed URL so the buyer/seller portal can upload a document
// straight to storage (bypassing the ~4.5 MB serverless body cap). Authorised
// by portal token. The file is recorded separately by POST /api/portal/documents.

import { NextRequest, NextResponse } from "next/server";
import { resolvePortalUploadContact } from "@/lib/portal/upload-auth";
import { createDocumentUploadUrl } from "@/lib/supabase-storage";
import { buildDocumentStoragePath, validateUploadRequest } from "@/lib/upload/document-upload";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const contact = await resolvePortalUploadContact(token);
  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: { filename?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rejection = validateUploadRequest({
    filename: body.filename ?? "",
    contentType: body.contentType ?? "",
    size: Number(body.size),
  });
  if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

  const storagePath = buildDocumentStoragePath(contact.transactionId, body.filename!);
  try {
    const { uploadUrl } = await createDocumentUploadUrl(storagePath);
    return NextResponse.json({ uploadUrl, storagePath });
  } catch {
    return NextResponse.json({ error: "We couldn't start the upload. Please try again." }, { status: 500 });
  }
}

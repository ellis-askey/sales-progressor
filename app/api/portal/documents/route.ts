// POST /api/portal/documents
// Portal-side document FINALIZE — records a document the browser has already
// uploaded straight to storage via POST /api/portal/documents/upload-url.
// Authorised by portal token. The bytes never pass through this function, so
// large PDFs (surveys, TA forms, searches) are no longer capped at ~4.5 MB.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { storageObjectExists } from "@/lib/supabase-storage";
import { isKnownDocType } from "@/lib/portal-documents";
import { resolvePortalUploadContact } from "@/lib/portal/upload-auth";
import { ALLOWED_UPLOAD_MIME, MAX_DOCUMENT_BYTES } from "@/lib/upload/document-upload";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const contact = await resolvePortalUploadContact(token);
  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let body: {
    storagePath?: string;
    filename?: string;
    fileSize?: number;
    mimeType?: string;
    docType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { storagePath, filename, fileSize, mimeType } = body;
  if (!storagePath || !filename || !mimeType || typeof fileSize !== "number") {
    return NextResponse.json({ error: "Missing upload details" }, { status: 400 });
  }
  // The path must live under this file's own prefix — a caller can't record a
  // document that points at another transaction's storage.
  if (!storagePath.startsWith(`${contact.transactionId}/`)) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (!ALLOWED_UPLOAD_MIME.has(mimeType)) {
    return NextResponse.json({ error: "That file type isn't supported." }, { status: 400 });
  }
  if (fileSize <= 0 || fileSize > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "That file is over 25 MB." }, { status: 400 });
  }
  if (!(await storageObjectExists(storagePath))) {
    return NextResponse.json({ error: "Upload didn't complete. Please try again." }, { status: 400 });
  }

  const docType = typeof body.docType === "string" && isKnownDocType(body.docType) ? body.docType : null;

  const doc = await prisma.transactionDocument.create({
    data: {
      transactionId: contact.transactionId,
      contactId: contact.contactId,
      filename,
      storagePath,
      fileSize,
      mimeType,
      source: "portal",
      docType,
      // Purchaser uploads are attributable to their round; vendor uploads stay
      // file-level (NULL).
      buyerRoundId: contact.roleType === "purchaser" ? contact.buyerRoundId : null,
    },
  });

  await recordEvent({
    type: "file_uploaded",
    entityType: "TransactionDocument",
    entityId: doc.id,
    metadata: {
      transactionId: contact.transactionId,
      contactId: contact.contactId,
      source: "portal",
      mimeType,
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

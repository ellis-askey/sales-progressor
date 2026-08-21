// GET  /api/transactions/[id]/documents — list docs with signed URLs
// POST /api/transactions/[id]/documents — admin upload

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { storageObjectExists } from "@/lib/supabase-storage";
import { isKnownDocType } from "@/lib/portal-documents";
import { ALLOWED_UPLOAD_MIME, MAX_DOCUMENT_BYTES } from "@/lib/upload/document-upload";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Phase-2 PR 2 (TransactionDocument scoping): same OR filter the
  // file-detail DocumentsSection uses — file-level + active-round
  // purchaser uploads only. Routed through the shared service helper so
  // the two surfaces stay in lockstep.
  const { listLiveTransactionDocuments } = await import("@/lib/services/transaction-documents");
  const withUrls = await listLiveTransactionDocuments(id);

  return NextResponse.json(withUrls);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Finalize a document the browser uploaded straight to storage via
  // POST /api/transactions/[id]/documents/upload-url. The bytes never pass
  // through this function, so large PDFs are no longer capped at ~4.5 MB.
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
  if (!storagePath.startsWith(`${id}/`)) {
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
      transactionId: id,
      filename,
      storagePath,
      fileSize,
      mimeType,
      source: "admin",
      docType,
    },
  });
  await recordEvent({
    type: "file_uploaded",
    agencyId: session.user.agencyId || undefined,
    userId: session.user.id,
    entityType: "TransactionDocument",
    entityId: doc.id,
    metadata: { transactionId: id, source: "admin", mimeType },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

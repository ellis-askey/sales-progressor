// POST /api/portal/documents
// Portal-side document upload — authenticated by portal token (no admin session)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToStorage } from "@/lib/supabase-storage";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 3;

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 401 });

  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, propertyTransactionId: true, roleType: true },
  });
  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${file.name} exceeds 10 MB` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${contact.propertyTransactionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await uploadToStorage(storagePath, buffer, file.type);

    const doc = await prisma.transactionDocument.create({
      data: {
        transactionId: contact.propertyTransactionId,
        contactId: contact.id,
        filename: file.name,
        storagePath,
        fileSize: file.size,
        mimeType: file.type,
        source: "portal",
      },
    });

    results.push(doc);
  }

  return NextResponse.json({ documents: results }, { status: 201 });
}

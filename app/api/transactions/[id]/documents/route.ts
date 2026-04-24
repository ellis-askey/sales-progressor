// GET  /api/transactions/[id]/documents — list docs with signed URLs
// POST /api/transactions/[id]/documents — admin upload

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToStorage, getSignedUrl } from "@/lib/supabase-storage";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const docs = await prisma.transactionDocument.findMany({
    where: { transactionId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, filename: true, storagePath: true, fileSize: true,
      mimeType: true, source: true, createdAt: true,
      contact: { select: { name: true, roleType: true } },
    },
  });

  const withUrls = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      signedUrl: await getSignedUrl(d.storagePath).catch(() => null),
    }))
  );

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

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files` }, { status: 400 });

  const results = [];
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `${file.name} exceeds 10 MB` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await uploadToStorage(storagePath, buffer, file.type);

    const doc = await prisma.transactionDocument.create({
      data: {
        transactionId: id,
        filename: file.name,
        storagePath,
        fileSize: file.size,
        mimeType: file.type,
        source: "admin",
      },
    });
    results.push(doc);
  }

  return NextResponse.json({ documents: results }, { status: 201 });
}

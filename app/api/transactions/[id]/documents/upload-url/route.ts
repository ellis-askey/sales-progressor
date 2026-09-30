// POST /api/transactions/[id]/documents/upload-url
// Mints a one-time signed URL so an agent can upload a document straight to
// storage (bypassing the ~4.5 MB serverless body cap). Session-authorised and
// scoped to the agent's agency. The file is recorded separately by
// POST /api/transactions/[id]/documents.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDocumentUploadUrl } from "@/lib/supabase-storage";
import { buildDocumentStoragePath, validateUploadRequest } from "@/lib/upload/document-upload";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  // Law 7: scope by the caller's access scope, not a bare agencyId (which was ""
  // for internal staff and blind to progression-business members).
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(getAccessScope(session), id),
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const storagePath = buildDocumentStoragePath(id, body.filename!);
  try {
    const { uploadUrl } = await createDocumentUploadUrl(storagePath);
    return NextResponse.json({ uploadUrl, storagePath });
  } catch {
    return NextResponse.json({ error: "We couldn't start the upload. Please try again." }, { status: 500 });
  }
}

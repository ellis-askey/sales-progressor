import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteResponse } from "@/lib/forms/service";
import { getFormFileSignedUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  const response = await prisma.tenantFormResponse.findFirst({
    where: { id: params.responseId, formId: params.formId, form: { tenantId: session.tenantId } },
    include: { uploads: true },
  });
  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });

  const files = await Promise.all(
    response.uploads.map(async (u) => ({
      id: u.id,
      questionId: u.questionId,
      fileName: u.fileName,
      mimeType: u.mimeType,
      sizeBytes: u.sizeBytes,
      url: await getFormFileSignedUrl(u.storagePath, 3600).catch(() => null),
    }))
  );

  return NextResponse.json({
    id: response.id,
    answers: response.answers,
    meta: response.meta,
    submittedAt: response.submittedAt.toISOString(),
    files,
  });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  const ok = await deleteResponse(session.tenantId, params.formId, params.responseId);
  if (!ok) return NextResponse.json({ error: "Response not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

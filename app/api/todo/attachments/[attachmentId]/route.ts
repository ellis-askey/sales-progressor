import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFormsAuth } from "@/lib/forms/api";
import { assertTaskAccess } from "@/lib/todo/service";
import { getFormFileSignedUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  const attachment = await prisma.todoAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  await assertTaskAccess(session.tenantId, session.userId, attachment.taskId);
  const url = await getFormFileSignedUrl(attachment.storagePath, 3600);
  return NextResponse.json({ url, fileName: attachment.fileName });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  const attachment = await prisma.todoAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment) return NextResponse.json({ ok: true });
  await assertTaskAccess(session.tenantId, session.userId, attachment.taskId);
  await prisma.todoAttachment.delete({ where: { id: params.attachmentId } });
  return NextResponse.json({ ok: true });
});

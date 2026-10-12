import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { withFormsAuth } from "@/lib/forms/api";
import { assertTaskAccess } from "@/lib/todo/service";
import { uploadFormFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const BLOCKED_MIME_PREFIXES = ["application/x-", "application/javascript", "text/html", "image/svg"];

// Task attachments live in the same private bucket as form uploads, under a
// todo/ prefix, and are only ever served to the authenticated tenant via
// short-lived signed URLs.
export const POST = withFormsAuth(async (req, session, params) => {
  await assertTaskAccess(session.tenantId, session.userId, params.taskId);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const commentId = formData?.get("commentId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Files need to be under 15 MB." }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return NextResponse.json({ error: "That file type isn't supported." }, { status: 400 });
  }

  const safeName = (file.name || "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  const path = `todo/${session.tenantId}/${params.taskId}/${crypto.randomUUID()}/${safeName}`;
  await uploadFormFile(path, Buffer.from(await file.arrayBuffer()), mime);

  const attachment = await prisma.todoAttachment.create({
    data: {
      taskId: params.taskId,
      commentId: typeof commentId === "string" && commentId ? commentId : null,
      uploaderId: session.userId,
      storagePath: path,
      fileName: safeName,
      mimeType: mime,
      sizeBytes: file.size,
    },
  });
  return NextResponse.json({ attachment }, { status: 201 });
});

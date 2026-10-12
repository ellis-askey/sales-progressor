import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/forms/api";
import { checkFormsSubmitLimit, rateLimitJson } from "@/lib/ratelimit";
import { getPublicForm } from "@/lib/forms/service";
import { uploadFormFile } from "@/lib/supabase-storage";
import type { FormDefinition } from "@/lib/forms/types";

export const runtime = "nodejs";

const HARD_MAX_BYTES = 15 * 1024 * 1024; // absolute ceiling regardless of config

const MIME_BY_KIND: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"],
  pdf: ["application/pdf"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
};

// Dangerous-by-default types we never accept, even under "any".
const BLOCKED_MIME_PREFIXES = ["application/x-", "application/javascript", "text/html", "image/svg"];

// Public upload endpoint for file_upload + signature questions. The returned
// upload id is included in the final submission; createResponse() claims only
// unowned uploads for the same form, so an id can't be replayed across forms.
export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;

  const limit = await checkFormsSubmitLimit(clientIp(req), `${publicId}:upload`);
  if (!limit.success) return NextResponse.json(rateLimitJson(limit), { status: 429 });

  const state = await getPublicForm(publicId);
  if (state.state !== "open") {
    return NextResponse.json({ error: "This form is no longer accepting files." }, { status: 410 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const questionId = formData?.get("questionId");
  if (!(file instanceof File) || typeof questionId !== "string") {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const formRow = await prisma.tenantForm.findUnique({ where: { publicId }, select: { id: true, published: true } });
  if (!formRow?.published) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  const def = formRow.published as unknown as FormDefinition;
  const question = def.questions.find((q) => q.id === questionId);
  if (!question || (question.type !== "file_upload" && question.type !== "signature")) {
    return NextResponse.json({ error: "This question doesn't accept files." }, { status: 400 });
  }

  const maxBytes = Math.min(
    (question.maxFileSizeMb ?? 10) * 1024 * 1024,
    HARD_MAX_BYTES
  );
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Files need to be under ${Math.round(maxBytes / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  const mime = file.type || "application/octet-stream";
  if (BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return NextResponse.json({ error: "That file type isn't supported." }, { status: 400 });
  }
  if (question.type === "signature") {
    if (mime !== "image/png") return NextResponse.json({ error: "Signature needs to be an image." }, { status: 400 });
  } else {
    const kinds = question.acceptedFileTypes?.length ? question.acceptedFileTypes : ["any"];
    if (!kinds.includes("any")) {
      const allowed = kinds.flatMap((k) => MIME_BY_KIND[k] ?? []);
      if (!allowed.includes(mime)) {
        return NextResponse.json({ error: "That file type isn't accepted here." }, { status: 400 });
      }
    }
  }

  // Cap accumulation per form so an attacker can't fill the bucket between
  // uploads and submission: max 200 unclaimed uploads per form at once.
  const unclaimed = await prisma.tenantFormUpload.count({
    where: { formId: formRow.id, responseId: null },
  });
  if (unclaimed > 200) {
    return NextResponse.json({ error: "Uploads are busy right now. Try again shortly." }, { status: 429 });
  }

  const safeName = (file.name || "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  const path = `${formRow.id}/${crypto.randomUUID()}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadFormFile(path, bytes, mime);

  const upload = await prisma.tenantFormUpload.create({
    data: {
      formId: formRow.id,
      questionId,
      storagePath: path,
      fileName: safeName,
      mimeType: mime,
      sizeBytes: file.size,
    },
  });

  return NextResponse.json({ id: upload.id, fileName: safeName });
}

import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteForm, getForm, renameForm } from "@/lib/forms/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  const form = await getForm(session.tenantId, params.formId);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({
    id: form.id,
    title: form.title,
    status: form.status,
    publicId: form.publicId,
    draft: form.draft,
    published: form.published,
    publishedAt: form.publishedAt,
    responseCount: form.responseCount,
    lastEditedAt: form.lastEditedAt,
    updatedAt: form.updatedAt,
  });
});

export const PATCH = withFormsAuth(async (req, session, params) => {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Give the form a name." }, { status: 400 });
  }
  const form = await renameForm(session.tenantId, params.formId, body.title.trim());
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  const deleted = await deleteForm(session.tenantId, params.formId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Only archived forms can be removed for good. Archive it first." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
});

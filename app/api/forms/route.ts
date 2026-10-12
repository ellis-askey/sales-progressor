import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createForm, listForms } from "@/lib/forms/service";
import { getTemplate } from "@/lib/forms/templates";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session) => {
  const forms = await listForms(session.tenantId);
  return NextResponse.json({ forms });
});

export const POST = withFormsAuth(async (req, session) => {
  const body = (await req.json().catch(() => ({}))) as { title?: string; templateId?: string };
  const template = body.templateId ? getTemplate(body.templateId) : undefined;
  const form = await createForm(session.tenantId, session.userId, {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    definition: template?.build(),
  });
  return NextResponse.json({ id: form.id }, { status: 201 });
});

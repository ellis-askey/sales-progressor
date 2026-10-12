import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { duplicateForm } from "@/lib/forms/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (_req, session, params) => {
  const copy = await duplicateForm(session.tenantId, params.formId);
  if (!copy) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({ id: copy.id }, { status: 201 });
});

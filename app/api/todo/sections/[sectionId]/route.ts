import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteSection, updateSection } from "@/lib/todo/service";

export const runtime = "nodejs";

export const PATCH = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const section = await updateSection(session.tenantId, session.userId, params.sectionId, body);
  return NextResponse.json({ section });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteSection(session.tenantId, session.userId, params.sectionId);
  return NextResponse.json({ ok: true });
});

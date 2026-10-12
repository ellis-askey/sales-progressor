import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteLabel, updateLabel } from "@/lib/todo/service";

export const runtime = "nodejs";

export const PATCH = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const label = await updateLabel(session.tenantId, params.labelId, body);
  return NextResponse.json({ label });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteLabel(session.tenantId, params.labelId);
  return NextResponse.json({ ok: true });
});

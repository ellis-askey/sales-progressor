import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteProject, updateProject } from "@/lib/todo/service";

export const runtime = "nodejs";

export const PATCH = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const project = await updateProject(session.tenantId, session.userId, params.projectId, body);
  return NextResponse.json({ project });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteProject(session.tenantId, session.userId, params.projectId);
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { duplicateProject } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const project = await duplicateProject(session.tenantId, session.userId, params.projectId, body);
  return NextResponse.json({ project }, { status: 201 });
});

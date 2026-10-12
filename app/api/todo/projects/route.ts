import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createProject } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const project = await createProject(session.tenantId, session.userId, body);
  return NextResponse.json({ project }, { status: 201 });
});

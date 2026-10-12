import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createSection } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const section = await createSection(session.tenantId, session.userId, params.projectId, String(body.name ?? ""));
  return NextResponse.json({ section }, { status: 201 });
});

import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { shareProject } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  if (typeof body.userId !== "string") {
    return NextResponse.json({ error: "Choose a team member." }, { status: 400 });
  }
  await shareProject(session.tenantId, session.userId, params.projectId, body.userId, body.remove === true);
  return NextResponse.json({ ok: true });
});

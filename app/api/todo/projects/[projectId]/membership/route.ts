import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { setMembership } from "@/lib/todo/service";

export const runtime = "nodejs";

// Personal relationship to a project: favourite flag + remembered view.
export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  await setMembership(session.tenantId, session.userId, params.projectId, body);
  return NextResponse.json({ ok: true });
});

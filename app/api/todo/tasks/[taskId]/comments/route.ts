import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { addComment } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const comment = await addComment(session.tenantId, session.userId, params.taskId, String(body.body ?? ""));
  return NextResponse.json({ comment }, { status: 201 });
});

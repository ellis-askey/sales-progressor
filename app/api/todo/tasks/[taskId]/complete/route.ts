import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { setTaskCompletion } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const task = await setTaskCompletion(session.tenantId, session.userId, params.taskId, body.completed !== false);
  return NextResponse.json({ task });
});

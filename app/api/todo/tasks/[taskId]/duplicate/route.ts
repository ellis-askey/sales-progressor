import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { duplicateTask } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (_req, session, params) => {
  const task = await duplicateTask(session.tenantId, session.userId, params.taskId);
  return NextResponse.json({ task }, { status: 201 });
});

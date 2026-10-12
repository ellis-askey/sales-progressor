import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteTask, getTaskDetail, updateTask } from "@/lib/todo/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  return NextResponse.json(await getTaskDetail(session.tenantId, session.userId, params.taskId));
});

export const PATCH = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const task = await updateTask(session.tenantId, session.userId, params.taskId, body);
  return NextResponse.json({ task });
});

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteTask(session.tenantId, session.userId, params.taskId);
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { setReminder } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session, params) => {
  const body = await req.json().catch(() => ({}));
  const reminder = await setReminder(session.tenantId, session.userId, params.taskId, body);
  return NextResponse.json({ reminder }, { status: 201 });
});

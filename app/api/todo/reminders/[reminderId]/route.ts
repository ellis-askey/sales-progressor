import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteReminder } from "@/lib/todo/service";

export const runtime = "nodejs";

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteReminder(session.tenantId, session.userId, params.reminderId);
  return NextResponse.json({ ok: true });
});

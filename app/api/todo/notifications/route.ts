import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { listNotifications, markNotificationsRead } from "@/lib/todo/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session) => {
  const notifications = await listNotifications(session.tenantId, session.userId);
  return NextResponse.json({ notifications });
});

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  await markNotificationsRead(session.tenantId, session.userId, Array.isArray(body.ids) ? body.ids : undefined);
  return NextResponse.json({ ok: true });
});

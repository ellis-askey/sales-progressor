import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteFilter } from "@/lib/todo/service";

export const runtime = "nodejs";

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteFilter(session.tenantId, session.userId, params.filterId);
  return NextResponse.json({ ok: true });
});

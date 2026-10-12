import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { deleteComment } from "@/lib/todo/service";

export const runtime = "nodejs";

export const DELETE = withFormsAuth(async (_req, session, params) => {
  await deleteComment(session.tenantId, session.userId, params.commentId);
  return NextResponse.json({ ok: true });
});

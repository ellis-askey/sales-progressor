import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { saveFilter } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const filter = await saveFilter(session.tenantId, session.userId, body);
  return NextResponse.json({ filter }, { status: 201 });
});

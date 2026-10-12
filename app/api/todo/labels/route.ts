import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { createLabel } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const label = await createLabel(session.tenantId, String(body.name ?? ""), body.color);
  return NextResponse.json({ label }, { status: 201 });
});

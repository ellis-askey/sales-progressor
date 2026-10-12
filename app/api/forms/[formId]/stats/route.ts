import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { getFormStats } from "@/lib/forms/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session, params) => {
  const stats = await getFormStats(session.tenantId, params.formId);
  if (!stats) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json(stats);
});

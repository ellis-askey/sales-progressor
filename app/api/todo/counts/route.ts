import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { getCounts } from "@/lib/todo/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session) => {
  return NextResponse.json(await getCounts(session.tenantId, session.userId));
});

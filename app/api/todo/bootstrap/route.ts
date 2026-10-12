import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { getBootstrap, getCounts } from "@/lib/todo/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (_req, session) => {
  const [bootstrap, counts] = await Promise.all([
    getBootstrap(session.tenantId, session.userId),
    getCounts(session.tenantId, session.userId),
  ]);
  return NextResponse.json({ ...bootstrap, counts });
});

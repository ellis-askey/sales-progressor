import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { listResponses } from "@/lib/forms/service";

export const runtime = "nodejs";

export const GET = withFormsAuth(async (req, session, params) => {
  const url = new URL(req.url);
  const result = await listResponses(session.tenantId, params.formId, {
    cursor: url.searchParams.get("cursor") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    take: 50,
  });
  if (!result) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json({
    responses: result.responses.map((r) => ({
      id: r.id,
      answers: r.answers,
      meta: r.meta,
      submittedAt: r.submittedAt.toISOString(),
    })),
    nextCursor: result.nextCursor,
  });
});

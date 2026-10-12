import { NextResponse } from "next/server";
import { getPublicForm, recordFormEvent } from "@/lib/forms/service";

export const runtime = "nodejs";

// Public, unauthenticated. Serves only the published copy with internal
// settings stripped (see getPublicForm). The /f/[publicId] page fetches
// server-side; this endpoint also backs the embed snippet.
export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const result = await getPublicForm(publicId);
  if (result.state === "not_found") {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// View/start beacons for completion-rate analytics. Best-effort — failures
// are swallowed so analytics can never break a respondent.
export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { event?: string };
  if (body.event === "view" || body.event === "start") {
    await recordFormEvent(publicId, body.event).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

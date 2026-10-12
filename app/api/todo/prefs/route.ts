import { NextResponse } from "next/server";
import { withFormsAuth } from "@/lib/forms/api";
import { savePrefs } from "@/lib/todo/service";

export const runtime = "nodejs";

export const POST = withFormsAuth(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  await savePrefs(session.userId, body && typeof body === "object" ? body : {});
  return NextResponse.json({ ok: true });
});

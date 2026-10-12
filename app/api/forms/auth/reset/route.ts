import { NextResponse } from "next/server";
import { consumeResetToken, validatePasswordStrength } from "@/lib/forms/auth";
import { clientIp } from "@/lib/forms/api";
import { checkFormsAuthLimit, rateLimitJson } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = await checkFormsAuthLimit(clientIp(req));
  if (!limit.success) return NextResponse.json(rateLimitJson(limit), { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { token?: string; newPassword?: string };
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  const strength = validatePasswordStrength(newPassword);
  if (strength) return NextResponse.json({ error: strength }, { status: 400 });
  if (!token) return NextResponse.json({ error: "This reset link isn't valid." }, { status: 400 });

  const ok = await consumeResetToken(token, newPassword);
  if (!ok) {
    return NextResponse.json(
      { error: "This reset link has expired or already been used. Request a new one." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { checkPortalLimit, rateLimitJson } from "@/lib/ratelimit";
import { getSession } from "@/lib/session";
import { sendPortalInviteByToken } from "@/lib/services/portal-invite";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Rate limit by portal token — prevents invite email flooding
  const rl = await checkPortalLimit(token).catch(() => ({ success: true, reset: 0, remaining: 999 }));
  if (!rl.success) {
    return NextResponse.json(rateLimitJson(rl), { status: 429 });
  }

  const origin = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const session = await getSession();
  const result = await sendPortalInviteByToken(token, {
    origin,
    actingUserId: session?.user?.id ?? null,
    actingUserRole: session?.user?.role ?? null,
  });
  if (!result.ok) {
    const status = result.error === "Invalid token" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}

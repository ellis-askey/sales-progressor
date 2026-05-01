import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret } from "@/lib/command/crypto";
import { recordAdminAction } from "@/lib/command/audit/write";
import { signSession, COOKIE_NAME } from "@/lib/command/session";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_FAILS,
  SESSION_HARD_MAX_MS,
} from "@/lib/command/config";
import { verifyTotp } from "@/lib/command/totp";

export const dynamic = "force-dynamic";

type UserWithTotp = { id: string; totpSecret: string | null; totpActivatedAt: Date | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = session.user.id;

  // Rate limit: count recent TOTP failures for this user (occurredAt is the field name)
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentFails = await prisma.adminAuditLog.count({
    where: {
      adminUserId: userId,
      action: "command.auth.totp_fail",
      occurredAt: { gte: windowStart },
    },
  });
  if (recentFails >= RATE_LIMIT_MAX_FAILS) {
    return NextResponse.redirect(new URL("/command/auth/step-up?error=rate_limited", req.url));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, totpSecret: true, totpActivatedAt: true },
  }) as UserWithTotp | null;

  if (!user?.totpSecret || !user.totpActivatedAt) {
    return NextResponse.redirect(new URL("/command/setup-2fa", req.url));
  }

  const formData = await req.formData();
  const code = formData.get("code")?.toString().trim() ?? "";

  if (!code) {
    return NextResponse.redirect(new URL("/command/auth/step-up?error=missing", req.url));
  }

  let plainSecret: string;
  try {
    plainSecret = decryptTotpSecret(user.totpSecret);
  } catch {
    return NextResponse.redirect(new URL("/command/auth/step-up?error=wrong_code", req.url));
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ua = req.headers.get("user-agent") ?? undefined;

  if (!verifyTotp(code, plainSecret)) {
    await recordAdminAction({
      adminUserId: userId,
      action: "command.auth.totp_fail",
      ipAddress: ip,
      userAgent: ua,
    });
    return NextResponse.redirect(new URL("/command/auth/step-up?error=wrong_code", req.url));
  }

  await recordAdminAction({
    adminUserId: userId,
    action: "command.auth.step_up",
    ipAddress: ip,
    userAgent: ua,
  });

  const now = Date.now();
  const cookie = signSession({ issuedAt: now, lastSeenAt: now, stepUpAt: now });

  const res = NextResponse.redirect(new URL("/command/overview", req.url));
  res.cookies.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/command",
    maxAge: SESSION_HARD_MAX_MS / 1000,
  });
  return res;
}

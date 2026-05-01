import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/command/crypto";
import { recordAdminAction } from "@/lib/command/audit/write";
import { verifyTotp } from "@/lib/command/totp";

export const dynamic = "force-dynamic";

type UserWithTotp = { id: string; totpActivatedAt: Date | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpActivatedAt: true },
  }) as UserWithTotp | null;

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.totpActivatedAt) {
    return NextResponse.redirect(new URL("/command/overview", req.url));
  }

  const formData = await req.formData();
  const encryptedSecret = formData.get("encryptedSecret")?.toString() ?? "";
  const code = formData.get("code")?.toString().trim() ?? "";

  if (!encryptedSecret || !code) {
    return NextResponse.redirect(new URL("/command/setup-2fa?error=missing", req.url));
  }

  let plainSecret: string;
  try {
    plainSecret = decryptTotpSecret(encryptedSecret);
  } catch {
    return NextResponse.redirect(new URL("/command/setup-2fa?error=invalid", req.url));
  }

  if (!verifyTotp(code, plainSecret)) {
    return NextResponse.redirect(new URL("/command/setup-2fa?error=wrong_code", req.url));
  }

  // Re-encrypt with a fresh IV before persisting
  const stored = encryptTotpSecret(plainSecret);

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: stored, totpActivatedAt: new Date() },
  });

  await recordAdminAction({
    adminUserId: user.id,
    action: "command.totp.enrolled",
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
}

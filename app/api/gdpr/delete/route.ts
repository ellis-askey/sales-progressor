import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import { STEP_UP_MAX_AGE_MS } from "@/lib/command/config";
import { recordAdminAction } from "@/lib/command/audit/write";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

function stepUpValid(cookie: string): boolean {
  const payload = verifySession(cookie);
  if (!payload) return false;
  return Date.now() - payload.stepUpAt <= STEP_UP_MAX_AGE_MS;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value ?? "";
  if (!stepUpValid(cookie)) {
    return NextResponse.json({ error: "Step-up authentication required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, hardDelete, confirmHardDelete, reason } = body as Record<string, unknown>;

  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }
  if (hardDelete === true && confirmHardDelete !== true) {
    return NextResponse.json(
      { error: "confirmHardDelete must be true when hardDelete is true" },
      { status: 400 }
    );
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ua = headerStore.get("user-agent") ?? undefined;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      agencyId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.role === "superadmin") {
    return NextResponse.json({ error: "Cannot delete superadmin accounts" }, { status: 400 });
  }

  const anonymisedEmail = `anon-${userId}@deleted.invalid`;

  if (hardDelete === true) {
    // Hard delete: anonymise first, then delete record + all auth sessions/accounts
    await prisma.$transaction(async (tx) => {
      // Nullify PII and disable login before deletion attempt
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Deleted User",
          email: anonymisedEmail,
          phone: null,
          password: null,
          totpSecret: null,
          totpActivatedAt: null,
        },
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await recordAdminAction({
      adminUserId: session.user.id,
      action: "gdpr.delete",
      targetType: "user",
      targetId: userId,
      beforeValue: { name: existing.name, email: existing.email, agencyId: existing.agencyId },
      afterValue: { deleted: true },
      reason: reason.trim(),
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({ ok: true, action: "hard_deleted", userId });
  }

  // Default: anonymise (erasure by replacement — preserves relational integrity)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Anonymised User",
        email: anonymisedEmail,
        phone: null,
        password: null,
        totpSecret: null,
        totpActivatedAt: null,
        retentionEmailOptOut: true,
      },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
  });

  await recordAdminAction({
    adminUserId: session.user.id,
    action: "gdpr.anonymise",
    targetType: "user",
    targetId: userId,
    beforeValue: { name: existing.name, email: existing.email, agencyId: existing.agencyId },
    afterValue: { name: "Anonymised User", email: anonymisedEmail },
    reason: reason.trim(),
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true, action: "anonymised", userId });
}

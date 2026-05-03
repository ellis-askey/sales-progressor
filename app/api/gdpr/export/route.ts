import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import { STEP_UP_MAX_AGE_MS } from "@/lib/command/config";
import { recordAdminAction } from "@/lib/command/audit/write";
import { cookies, headers } from "next/headers";

// TODO: For very large accounts, switch to a streaming/paginated export or
// background job that emails a download link. Current buffered approach is
// safe for typical user volumes but will hit serverless memory limits above
// ~50k records.

export const dynamic = "force-dynamic";

const CAP = 1000;

function stepUpValid(cookie: string): boolean {
  const payload = verifySession(cookie);
  if (!payload) return false;
  return Date.now() - payload.stepUpAt <= STEP_UP_MAX_AGE_MS;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value ?? "";
  if (!stepUpValid(cookie)) {
    return NextResponse.json({ error: "Step-up authentication required" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ua = headerStore.get("user-agent") ?? undefined;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      agencyId: true,
      firmName: true,
      createdAt: true,
      updatedAt: true,
      retentionEmailOptOut: true,
      agency: { select: { id: true, name: true } },
      sessions: { select: { sessionToken: true, expires: true } },
      accounts: { select: { provider: true, providerAccountId: true } },
      communications: {
        select: { id: true, createdAt: true, channel: true, subject: true },
        orderBy: { createdAt: "desc" },
        take: CAP,
      },
      sentPortalMessages: {
        select: { id: true, createdAt: true, content: true },
        orderBy: { createdAt: "desc" },
        take: CAP,
      },
      assignedTransactions: {
        select: { id: true, propertyAddress: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: CAP,
      },
      createdManualTasks: {
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: CAP,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await recordAdminAction({
    adminUserId: session.user.id,
    action: "gdpr.export",
    targetType: "user",
    targetId: userId,
    ipAddress: ip,
    userAgent: ua,
  });

  const truncatedFields: string[] = [];
  if (user.communications.length === CAP) truncatedFields.push("communications");
  if (user.sentPortalMessages.length === CAP) truncatedFields.push("sentPortalMessages");
  if (user.assignedTransactions.length === CAP) truncatedFields.push("assignedTransactions");
  if (user.createdManualTasks.length === CAP) truncatedFields.push("createdManualTasks");

  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    cap: CAP,
    data: user,
  });

  const res = new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  if (truncatedFields.length > 0) {
    res.headers.set("X-Export-Truncated", "true");
    res.headers.set(
      "X-Export-Truncation-Note",
      `${truncatedFields.join(", ")} capped at ${CAP}`
    );
  }

  return res;
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import { verifySession, signSession, COOKIE_NAME } from "@/lib/command/session";
import {
  STEP_UP_MAX_AGE_MS,
  IDLE_MAX_AGE_MS,
  SESSION_HARD_MAX_MS,
} from "@/lib/command/config";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

type UserWithTotp = { id: string; totpActivatedAt: Date | null };

export default async function CommandProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpActivatedAt: true },
  }) as UserWithTotp | null;

  if (!user) redirect("/dashboard");
  if (!user.totpActivatedAt) redirect("/command/setup-2fa");

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const payload = verifySession(cookie);

  if (!payload) redirect("/command/auth/step-up");

  const now = Date.now();
  if (now - payload.issuedAt > SESSION_HARD_MAX_MS) redirect("/login");
  if (now - payload.lastSeenAt > IDLE_MAX_AGE_MS || now - payload.stepUpAt > STEP_UP_MAX_AGE_MS) {
    redirect("/command/auth/step-up");
  }

  cookieStore.set(COOKIE_NAME, signSession({ ...payload, lastSeenAt: now }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/command",
    maxAge: SESSION_HARD_MAX_MS / 1000,
  });

  const headerStore = await headers();
  await recordAdminAction({
    adminUserId: user.id,
    action: "command.page_view",
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  }).catch(() => {});

  return <>{children}</>;
}

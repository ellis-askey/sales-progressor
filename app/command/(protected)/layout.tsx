import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import {
  STEP_UP_MAX_AGE_MS,
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
  if (now - payload.stepUpAt > STEP_UP_MAX_AGE_MS) redirect("/command/auth/step-up");

  // lastSeenAt refresh is handled by the step-up API route on re-auth;
  // cookieStore.set() is not permitted in Server Component layouts in Next.js 16.

  const headerStore = await headers();
  await recordAdminAction({
    adminUserId: user.id,
    action: "command.page_view",
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  }).catch(() => {});

  return <>{children}</>;
}

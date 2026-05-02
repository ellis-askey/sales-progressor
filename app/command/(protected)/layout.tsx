import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import { STEP_UP_MAX_AGE_MS, SESSION_HARD_MAX_MS } from "@/lib/command/config";
import { cookies, headers } from "next/headers";
import { CommandSidebar } from "@/components/command/CommandSidebar";
import type { Session } from "next-auth";
import type { CommandMode, CommandPreferences } from "@/lib/command/scope";

export const dynamic = "force-dynamic";

type UserWithTotp = {
  id: string;
  totpActivatedAt: Date | null;
  commandPreferences: unknown;
};

export default async function CommandProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/dashboard");
  }

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpActivatedAt: true, commandPreferences: true },
  })) as UserWithTotp | null;

  if (!user) redirect("/dashboard");
  if (!user.totpActivatedAt) redirect("/command/setup-2fa");

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const payload = verifySession(cookie);

  if (!payload) redirect("/command/auth/step-up");

  const now = Date.now();
  if (now - payload.issuedAt > SESSION_HARD_MAX_MS) redirect("/login");
  if (now - payload.stepUpAt > STEP_UP_MAX_AGE_MS) redirect("/command/auth/step-up");

  const headerStore = await headers();
  await recordAdminAction({
    adminUserId: user.id,
    action: "command.page_view",
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  }).catch(() => {});

  const agencies = await commandDb.agency.findMany({
    select: { id: true, name: true, modeProfile: true },
    orderBy: { name: "asc" },
  });

  const prefs = user.commandPreferences as CommandPreferences | null;
  const savedMode: CommandMode = prefs?.mode ?? "combined";
  const savedAgencyIds: string[] = prefs?.agencyIds ?? [];

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#0a0a0a" }}
    >
      <CommandSidebar
        agencies={agencies}
        savedMode={savedMode}
        savedAgencyIds={savedAgencyIds}
        adminEmail={(session as Session).user?.email ?? ""}
      />
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "#0a0a0a" }}
      >
        <div className="cmd-content p-8 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}

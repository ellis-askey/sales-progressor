import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";
import { verifySession, COOKIE_NAME } from "@/lib/command/session";
import {
  STEP_UP_MAX_AGE_MS,
  SESSION_HARD_MAX_MS,
} from "@/lib/command/config";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { CommandTabNav } from "@/components/command/TabNav";
import { CommandFilters } from "@/components/command/CommandFilters";
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, totpActivatedAt: true, commandPreferences: true },
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

  const headerStore = await headers();
  await recordAdminAction({
    adminUserId: user.id,
    action: "command.page_view",
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  }).catch(() => {});

  // Fetch agencies for the filter dropdown
  const agencies = await commandDb.agency.findMany({
    select: { id: true, name: true, modeProfile: true },
    orderBy: { name: "asc" },
  });

  const prefs = user.commandPreferences as CommandPreferences | null;
  const savedMode: CommandMode = prefs?.mode ?? "combined";
  const savedAgencyIds: string[] = prefs?.agencyIds ?? [];

  return (
    <AppShell session={session as Session} activePath="/command" todoCount={0}>
      <PageHeader title="Command Centre" subtitle="Platform intelligence" />
      <CommandFilters
        agencies={agencies}
        savedMode={savedMode}
        savedAgencyIds={savedAgencyIds}
      />
      <CommandTabNav />
      <div className="px-8 py-7 max-w-6xl">
        {children}
      </div>
    </AppShell>
  );
}

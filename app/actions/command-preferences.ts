"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { CommandMode } from "@/lib/command/scope";

export async function saveCommandPreferencesAction(mode: CommandMode, agencyIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { commandPreferences: { mode, agencyIds } },
  });
}

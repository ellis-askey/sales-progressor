"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { isAgentTheme, isMobileAgentTheme, type AgentTheme, type MobileAgentTheme } from "@/lib/agent/themes";

export async function updateAgentTheme(theme: AgentTheme) {
  const session = await requireSession();

  // Defensive validation — server actions can be called with arbitrary input
  if (!isAgentTheme(theme)) {
    return { ok: false as const, error: "Invalid theme" };
  }

  // Read existing preferences so we don't clobber other fields if they
  // get added later
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true },
  });

  const existingPrefs =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      agentPreferences: {
        ...existingPrefs,
        theme,
      },
    },
  });

  // Revalidate the agent layout so the next render uses the new theme
  revalidatePath("/agent", "layout");

  return { ok: true as const, theme };
}

export async function updateAgentMobileTheme(mobileTheme: MobileAgentTheme) {
  const session = await requireSession();

  if (!isMobileAgentTheme(mobileTheme)) {
    return { ok: false as const, error: "Invalid mobile theme" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true },
  });

  const existingPrefs =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      agentPreferences: {
        ...existingPrefs,
        mobileTheme,
      },
    },
  });

  revalidatePath("/agent", "layout");

  return { ok: true as const, mobileTheme };
}

export async function updateAgentNightMode(nightMode: boolean | null) {
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true },
  });

  const existingPrefs =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      agentPreferences: {
        ...existingPrefs,
        nightMode,
      },
    },
  });

  return { ok: true as const };
}

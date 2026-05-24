"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { isAgentTheme, isMobileAgentTheme, type AgentTheme, type MobileAgentTheme } from "@/lib/agent/themes";
import { isNotificationKey, type NotificationKey } from "@/lib/agent/notification-prefs";

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

// Flips a single email-notification toggle (morningDigest / weeklyBrief /
// clientConfirmationEmails / chainEmails) inside agentPreferences.notifications.
// Read-merge-write at two depths so we don't clobber other notification keys
// OR other root-level prefs (theme, mobileTheme, nightMode).
export async function updateAgentNotificationPrefAction(input: {
  key: NotificationKey;
  value: boolean;
}) {
  const session = await requireSession();

  if (!isNotificationKey(input.key)) {
    return { ok: false as const, error: "Invalid notification key" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true },
  });

  const root =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  // Narrow existing notification overrides to boolean values only — anything
  // else in there is data we didn't write and shouldn't preserve. Keeps the
  // type compatible with Prisma's InputJsonValue.
  const existingNotif: Record<string, boolean> = {};
  if (root.notifications && typeof root.notifications === "object") {
    for (const [k, v] of Object.entries(root.notifications as Record<string, unknown>)) {
      if (typeof v === "boolean") existingNotif[k] = v;
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      agentPreferences: {
        ...root,
        notifications: {
          ...existingNotif,
          [input.key]: input.value,
        },
      },
    },
  });

  return { ok: true as const, key: input.key, value: input.value };
}

// Retention email opt-out lives on its own column (not in agentPreferences
// JSON) because the existing retention sweep already gates on it. Kept as a
// separate column update for minimal blast radius; surfaced via the same UI.
export async function updateRetentionEmailOptOutAction(optedOut: boolean) {
  const session = await requireSession();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { retentionEmailOptOut: optedOut },
  });

  return { ok: true as const, optedOut };
}

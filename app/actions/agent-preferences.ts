"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { isAgentTheme, isMobileAgentTheme, type AgentTheme, type MobileAgentTheme } from "@/lib/agent/themes";
import { isNotificationKey, isPushKey, type NotificationKey, type PushKey } from "@/lib/agent/notification-prefs";
import { pushToUser } from "@/lib/services/push";

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

// Flips a single push-notification toggle inside
// agentPreferences.notifications.push. Read-merge-write at three depths:
// preserves root prefs (theme), other notification keys, and other push
// keys. Same pattern as updateAgentNotificationPrefAction.
export async function updateAgentPushPrefAction(input: {
  key: PushKey;
  value: boolean;
}) {
  const session = await requireSession();

  if (!isPushKey(input.key)) {
    return { ok: false as const, error: "Invalid push key" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agentPreferences: true },
  });

  const root =
    user?.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  const existingNotif: Record<string, unknown> =
    root.notifications && typeof root.notifications === "object"
      ? (root.notifications as Record<string, unknown>)
      : {};

  // Narrow existing push overrides to boolean values only.
  const existingPush: Record<string, boolean> = {};
  if (existingNotif.push && typeof existingNotif.push === "object") {
    for (const [k, v] of Object.entries(existingNotif.push as Record<string, unknown>)) {
      if (typeof v === "boolean") existingPush[k] = v;
    }
  }

  // Also narrow sibling notification keys (booleans only) so we don't poison
  // the JSON with stray unknown values during the merge.
  const cleanedNotif: Record<string, boolean | Record<string, boolean>> = {};
  for (const [k, v] of Object.entries(existingNotif)) {
    if (k === "push") continue;
    if (typeof v === "boolean") cleanedNotif[k] = v;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      agentPreferences: {
        ...root,
        notifications: {
          ...cleanedNotif,
          push: {
            ...existingPush,
            [input.key]: input.value,
          },
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

// Diagnostic — fires a one-off test push to every device subscribed by the
// current user. Bypasses per-event toggles (it's a "did setup work?" check,
// not an event-driven push).
//
// Surfaces three distinct failure modes so the user knows what's broken:
//   - reason: "no_devices"           — no subscription rows yet
//   - reason: "vapid_not_configured" — server lacks VAPID_PRIVATE_KEY or
//                                       VAPID_PUBLIC_KEY env vars; pushToUser
//                                       would silently no-op without them.
//                                       Caller needs to set the env on Vercel.
//   - ok + deliveredCount > 0        — request handed off to web-push; if the
//                                       device still doesn't show a notification
//                                       the failure is downstream (browser,
//                                       OS-level DND, or stale subscription).
export async function sendTestPushAction() {
  const session = await requireSession();

  const before = await prisma.agentPushSubscription.count({
    where: { userId: session.user.id },
  });

  if (before === 0) {
    return { ok: true as const, deliveredCount: 0, reason: "no_devices" as const };
  }

  // Server-side env check — surfaces the most common silent-failure mode.
  // Mirror the same gate that getWebPush() uses in lib/services/push.ts.
  // Diagnostic detail goes to the server log (which env var is missing);
  // the UI just sees the user-friendly "unavailable" copy via the reason.
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    const missing = [
      !process.env.VAPID_PRIVATE_KEY ? "VAPID_PRIVATE_KEY" : null,
      !process.env.VAPID_PUBLIC_KEY ? "VAPID_PUBLIC_KEY" : null,
    ].filter(Boolean);
    console.error(`[sendTestPushAction] push unavailable — missing env: ${missing.join(", ")}`);
    return {
      ok: true as const,
      deliveredCount: 0,
      reason: "vapid_not_configured" as const,
    };
  }

  await pushToUser(session.user.id, {
    title: "Push notifications are on",
    body:  "You're all set, this is a test.",
    url:   `${process.env.NEXTAUTH_URL ?? ""}/agent/account/notifications`,
  });

  // pushToUser prunes any subscriptions that 404/410 — recount to report
  // accurately how many devices the test actually reached.
  const after = await prisma.agentPushSubscription.count({
    where: { userId: session.user.id },
  });

  return { ok: true as const, deliveredCount: after };
}

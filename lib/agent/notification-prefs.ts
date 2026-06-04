// Single source of truth for "which automated emails should this agent receive?"
// Reads two storage locations:
//   - User.agentPreferences.notifications (JSON) — for new toggles added by this
//     feature (morning digest, weekly brief, client confirmation emails, chain
//     emails). Read-merge-write pattern, same as the existing theme prefs.
//   - User.retentionEmailOptOut (Boolean column) — pre-existing retention-sweep
//     gate. Surfaced through this helper so the UI + retention service share
//     one resolution point even though the storage is split.
//
// Every gate (cron filters, ad-hoc email-send paths, settings UI) calls this
// helper. Defaults are ON (current behaviour preserved) — users opt out, never
// opt in. Adding a new toggle means: extend NotificationPrefs + add a default
// here + read the new key wherever the email fires.

import { prisma } from "@/lib/prisma";

export type NotificationKey =
  | "morningDigest"
  | "weeklyBrief"
  | "clientConfirmationEmails"
  | "chainEmails";

// Per-event push notification toggles. Distinct namespace from email keys
// because pushes are more intrusive and have different sensible defaults
// (most ON for urgent stuff, client-confirmation OFF because volume is high).
export type PushKey =
  | "clientConfirmation"      // buyer/seller confirmed a milestone via portal
  | "clientChaseNote"         // buyer/seller left a note on the Respond page
  | "chaseEscalation"         // a chase task got bumped to escalated priority
  | "fileAssigned"            // a file was assigned/reassigned to me
  | "exchangeApproaching"     // expectedExchangeDate is within 7 days
  | "chainEvent"              // chain link event affecting my file
  | "saleRelisted";           // a withdrawn file I own was relisted with a new buyer

export type NotificationPrefs = {
  morningDigest: boolean;
  weeklyBrief: boolean;
  clientConfirmationEmails: boolean;
  chainEmails: boolean;
  // retentionEmails is derived from User.retentionEmailOptOut. Surfaced here
  // so the settings UI can present it alongside the JSON-backed toggles
  // without callers needing to know about the storage split.
  retentionEmails: boolean;
  push: Record<PushKey, boolean>;
};

export const DEFAULT_PUSH_PREFS: Record<PushKey, boolean> = {
  clientConfirmation:  false,  // high-volume potential; agent opts in
  clientChaseNote:     true,   // already firing today; behaviour preserved
  chaseEscalation:     true,   // urgent — something's going wrong
  fileAssigned:        true,   // workload changed; one-off, infrequent
  exchangeApproaching: true,   // time-sensitive
  chainEvent:          true,   // urgent, downstream impact
  saleRelisted:        true,   // operationally critical: the relist promises
                                // the new buyer a call within two working days;
                                // the SP must know the file is back live
};

// Email-channel defaults are ALL on (preserves behaviour); push defaults
// are conservative (see per-key reasoning above).
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  morningDigest: true,
  weeklyBrief: true,
  clientConfirmationEmails: true,
  chainEmails: true,
  retentionEmails: true,
  push: { ...DEFAULT_PUSH_PREFS },
};

export const NOTIFICATION_KEYS: readonly NotificationKey[] = [
  "morningDigest",
  "weeklyBrief",
  "clientConfirmationEmails",
  "chainEmails",
];

export const PUSH_KEYS: readonly PushKey[] = [
  "clientConfirmation",
  "clientChaseNote",
  "chaseEscalation",
  "fileAssigned",
  "exchangeApproaching",
  "chainEvent",
  "saleRelisted",
];

export function isNotificationKey(value: string): value is NotificationKey {
  return (NOTIFICATION_KEYS as readonly string[]).includes(value);
}

export function isPushKey(value: string): value is PushKey {
  return (PUSH_KEYS as readonly string[]).includes(value);
}

// Parses the agentPreferences JSON safely — returns the partial overrides only;
// callers apply DEFAULT_NOTIFICATION_PREFS on top.
function parseNotificationOverrides(prefs: unknown): Partial<NotificationPrefs> {
  if (!prefs || typeof prefs !== "object") return {};
  const root = prefs as Record<string, unknown>;
  const notif = root.notifications;
  if (!notif || typeof notif !== "object") return {};
  const out: Partial<NotificationPrefs> = {};
  const n = notif as Record<string, unknown>;
  if (typeof n.morningDigest === "boolean") out.morningDigest = n.morningDigest;
  if (typeof n.weeklyBrief === "boolean") out.weeklyBrief = n.weeklyBrief;
  if (typeof n.clientConfirmationEmails === "boolean") out.clientConfirmationEmails = n.clientConfirmationEmails;
  if (typeof n.chainEmails === "boolean") out.chainEmails = n.chainEmails;

  // Push sub-object — boolean values only, ignored otherwise.
  if (n.push && typeof n.push === "object") {
    const push: Partial<Record<PushKey, boolean>> = {};
    const p = n.push as Record<string, unknown>;
    for (const key of PUSH_KEYS) {
      const v = p[key];
      if (typeof v === "boolean") push[key] = v;
    }
    if (Object.keys(push).length > 0) {
      out.push = { ...DEFAULT_PUSH_PREFS, ...push };
    }
  }
  return out;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agentPreferences: true, retentionEmailOptOut: true },
  });
  if (!user) return { ...DEFAULT_NOTIFICATION_PREFS, push: { ...DEFAULT_PUSH_PREFS } };
  const overrides = parseNotificationOverrides(user.agentPreferences);
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...overrides,
    retentionEmails: !user.retentionEmailOptOut,
    push: overrides.push ?? { ...DEFAULT_PUSH_PREFS },
  };
}

// Batch lookup for cron jobs that filter a recipient list. Returns a map keyed
// by userId so the caller can do `prefs.get(u.id)?.morningDigest !== false`.
export async function getNotificationPrefsForUsers(
  userIds: string[],
): Promise<Map<string, NotificationPrefs>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, agentPreferences: true, retentionEmailOptOut: true },
  });
  const out = new Map<string, NotificationPrefs>();
  for (const u of users) {
    const overrides = parseNotificationOverrides(u.agentPreferences);
    out.set(u.id, {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...overrides,
      retentionEmails: !u.retentionEmailOptOut,
      push: overrides.push ?? { ...DEFAULT_PUSH_PREFS },
    });
  }
  return out;
}

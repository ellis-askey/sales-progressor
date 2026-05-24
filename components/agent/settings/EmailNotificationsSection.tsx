"use client";

// Per-user email-notification toggles. Five rows:
//   - Morning digest
//   - Weekly brief
//   - Client confirmations
//   - Chain updates
//   - Retention emails
//
// The first four flip a key inside agentPreferences.notifications JSON via
// updateAgentNotificationPrefAction. Retention emails write to the
// User.retentionEmailOptOut column via updateRetentionEmailOptOutAction
// (separate column for legacy gating reasons — surfaced through the same UI).
//
// Bell notifications are deliberately NOT toggleable here — they always fire.
// These toggles silence the email duplicate only.

import { useState, useTransition } from "react";
import {
  updateAgentNotificationPrefAction,
  updateRetentionEmailOptOutAction,
} from "@/app/actions/agent-preferences";
import type { NotificationPrefs, NotificationKey } from "@/lib/agent/notification-prefs";

type ToggleSpec = {
  key: NotificationKey | "retentionEmails";
  label: string;
  description: string;
};

const TOGGLES: ToggleSpec[] = [
  {
    key: "morningDigest",
    label: "Morning digest",
    description: "Daily summary of files needing attention (08:00 weekdays).",
  },
  {
    key: "weeklyBrief",
    label: "Weekly brief",
    description: "Monday summary of last week's activity and escalations.",
  },
  {
    key: "clientConfirmationEmails",
    label: "Client confirmations",
    description: "Email me when a buyer or seller confirms a milestone. The bell will still notify you.",
  },
  {
    key: "chainEmails",
    label: "Chain updates",
    description: "Email me when a chain link is lost, paused, or asking us to wait.",
  },
  {
    key: "retentionEmails",
    label: "Retention emails",
    description: "Post-exchange follow-ups we use to learn how the file went.",
  },
];

export function EmailNotificationsSection({ initialPrefs }: { initialPrefs: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function handleToggle(key: ToggleSpec["key"]) {
    if (isPending) return;
    const next = !prefs[key];
    // Optimistic: flip in-state, server can correct on error.
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    startTransition(async () => {
      try {
        if (key === "retentionEmails") {
          // retentionEmails ON in UI means optedOut=false; OFF means optedOut=true
          await updateRetentionEmailOptOutAction(!next);
        } else {
          await updateAgentNotificationPrefAction({ key, value: next });
        }
      } catch {
        // Revert on failure
        setPrefs((p) => ({ ...p, [key]: !next }));
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-slate-900/80 mb-1">Email notifications</h2>
        <p className="text-xs text-slate-900/50">
          Choose which automated emails reach your inbox. The in-app bell keeps showing everything — these toggles only suppress the email duplicates.
        </p>
      </div>

      <div className="space-y-3">
        {TOGGLES.map((t) => {
          const on = prefs[t.key];
          const saving = savingKey === t.key;
          return (
            <div
              key={t.key}
              className="flex items-start justify-between gap-4 py-2 border-t border-slate-200/40 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900/85">{t.label}</p>
                <p className="text-xs text-slate-900/55 mt-0.5">{t.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${on ? "Turn off" : "Turn on"} ${t.label}`}
                disabled={saving}
                onClick={() => handleToggle(t.key)}
                className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60"
                style={{ background: on ? "#FF6B4A" : "rgba(15,23,42,0.20)" }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: on ? "translateX(22px)" : "translateX(4px)", marginTop: 4 }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

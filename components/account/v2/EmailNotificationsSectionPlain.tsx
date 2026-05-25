"use client";

// components/account/v2/EmailNotificationsSectionPlain.tsx
//
// Email notification toggles for the Account/Notifications tab. Wiring
// identical to the original EmailNotificationsSection — five toggles
// driving updateAgentNotificationPrefAction (four of them) and
// updateRetentionEmailOptOutAction (retentionEmails goes to a separate
// User column for legacy gating reasons). Optimistic update, revert on
// failure, per-toggle saving indicator. Bell notifications are
// deliberately not toggleable — these only suppress the email
// duplicates.
//
// Presentation restyled to the clean Account register: no glass-card
// wrapper, the section header is rendered by the parent page, toggle
// rows separated by hairlines.

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

export function EmailNotificationsSectionPlain({
  initialPrefs,
}: {
  initialPrefs: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function handleToggle(key: ToggleSpec["key"]) {
    if (isPending) return;
    const next = !prefs[key];
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
        setPrefs((p) => ({ ...p, [key]: !next }));
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {TOGGLES.map((t, i) => {
        const on = prefs[t.key];
        const saving = savingKey === t.key;
        return (
          <div
            key={t.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              padding: "14px 0",
              borderTop: i === 0 ? "none" : "0.5px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>
                {t.label}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>
                {t.description}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Turn off" : "Turn on"} ${t.label}`}
              disabled={saving}
              onClick={() => handleToggle(t.key)}
              style={{
                position: "relative",
                display: "inline-flex",
                width: 44,
                height: 24,
                flexShrink: 0,
                borderRadius: 999,
                background: on ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
                border: "none",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
                transition: "background 150ms",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: on ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  transition: "left 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

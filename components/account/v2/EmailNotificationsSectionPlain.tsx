"use client";

// components/account/v2/EmailNotificationsSectionPlain.tsx
//
// Email notification toggles for the Account/Notifications tab. Wiring
// identical to before — five toggles driving updateAgentNotificationPrefAction
// (four) and updateRetentionEmailOptOutAction (retentionEmails is a separate
// User column). Optimistic update, revert on failure. Redesign: renders its own
// AccountCard with a master switch + All-on/All-off/Custom preset in the header.

import { useState, useTransition } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import {
  updateAgentNotificationPrefAction,
  updateRetentionEmailOptOutAction,
} from "@/app/actions/agent-preferences";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { SectionMasterControl } from "@/components/account/chrome/SectionMasterControl";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import type { NotificationPrefs, NotificationKey } from "@/lib/agent/notification-prefs";

type ToggleSpec = {
  key: NotificationKey | "retentionEmails";
  label: string;
  description: string;
};

const TOGGLES: ToggleSpec[] = [
  { key: "morningDigest", label: "Morning digest", description: "Daily summary of files needing attention, sent at 08:00 on weekdays." },
  { key: "weeklyBrief", label: "Weekly brief", description: "Weekly summary of activity and escalations, sent every Monday." },
  { key: "clientConfirmationEmails", label: "Client confirmations", description: "Email me when a buyer or seller confirms a milestone." },
  { key: "chainEmails", label: "Chain updates", description: "Email me when a chain link is lost, paused, or asking us to wait." },
  { key: "appointmentReminders", label: "Appointment reminders", description: "Email me when a survey or lender valuation is booked, with a reminder at 7am on the day." },
  { key: "retentionEmails", label: "Retention emails", description: "Post-exchange follow-ups that help us learn how the file went." },
];

export function EmailNotificationsSectionPlain({ initialPrefs }: { initialPrefs: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function persist(key: ToggleSpec["key"], value: boolean) {
    if (key === "retentionEmails") {
      // retentionEmails ON in UI means optedOut=false; OFF means optedOut=true.
      await updateRetentionEmailOptOutAction(!value);
    } else {
      await updateAgentNotificationPrefAction({ key, value });
    }
  }

  function handleToggle(key: ToggleSpec["key"]) {
    if (isPending) return;
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    startTransition(async () => {
      try {
        await persist(key, next);
      } catch {
        setPrefs((p) => ({ ...p, [key]: !next }));
      } finally {
        setSavingKey(null);
      }
    });
  }

  function setAll(value: boolean) {
    if (isPending) return;
    const prev = prefs;
    const changed = TOGGLES.filter((t) => prev[t.key] !== value);
    if (changed.length === 0) return;
    setPrefs((p) => {
      const n = { ...p };
      for (const t of changed) n[t.key] = value;
      return n;
    });
    startTransition(async () => {
      try {
        await Promise.all(changed.map((t) => persist(t.key, value)));
      } catch {
        setPrefs(prev);
      }
    });
  }

  return (
    <AccountCard
      icon={<EnvelopeSimple size={18} weight="bold" />}
      title="Email notifications"
      subtitle="Your in-app bell shows everything. These settings only control which notifications are also emailed to you."
      headerAction={<SectionMasterControl values={TOGGLES.map((t) => prefs[t.key])} onSetAll={setAll} disabled={isPending} />}
      bodyStyle={{ marginTop: 8 }}
    >
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
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{t.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>{t.description}</p>
              </div>
              <LiquidToggle
                checked={on}
                onChange={() => handleToggle(t.key)}
                width={44}
                height={24}
                color="var(--agent-coral, #FF8A65)"
                disabled={saving}
                aria-label={`${on ? "Turn off" : "Turn on"} ${t.label}`}
              />
            </div>
          );
        })}
      </div>
    </AccountCard>
  );
}

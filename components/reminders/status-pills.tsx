// Shared reminder pills + the fallback-chip copy, used by BOTH the Reminders
// page (AgentRemindersList) and the property-file Reminders tab (RemindersSection)
// so the urgency, side and "chase manually" chips are identical everywhere. All
// compose the canonical StatusPill (icon + collapsible label).

import { Clock, Warning, CalendarBlank, HandTap, LockSimple } from "@phosphor-icons/react";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { StatusPill } from "./StatusPill";

export type UrgencyBucket = "escalated" | "overdue" | "due_today" | "upcoming";

// Urgency pill. The label is computed by the caller (e.g. "3d overdue", "Due
// today", "Was due 3 Sep", "Next 8 Sep"); this maps the bucket to the tone + icon.
// A chased-but-not-escalated row goes muted, matching the file tab's calm-down.
export function UrgencyPill({ label, bucket, chased }: { label: string; bucket: UrgencyBucket; chased?: boolean }) {
  if (chased && bucket !== "escalated") {
    return <StatusPill tone="muted" icon={<Clock size={11} weight="bold" />} label={label} />;
  }
  switch (bucket) {
    case "escalated": return <StatusPill tone="danger" icon={<Warning size={11} weight="fill" />} label={label} />;
    case "overdue":   return <StatusPill tone="danger" icon={<Clock size={11} weight="bold" />} label={label} />;
    case "due_today": return <StatusPill tone="warning" icon={<Clock size={11} weight="bold" />} label={label} />;
    default:          return <StatusPill tone="muted" icon={<CalendarBlank size={11} weight="bold" />} label={label} />;
  }
}

// "Blocks Exchange" flag — shown when the chased milestone gates exchange.
export function BlocksExchangePill() {
  return <StatusPill tone="danger" icon={<LockSimple size={11} weight="bold" />} label="Blocks Exchange" />;
}

// Seller / Buyer side pill.
export function SidePill({ isBuyer }: { isBuyer: boolean }) {
  return (
    <StatusPill
      tone={isBuyer ? "info" : "warning"}
      icon={<RoleIcon role={isBuyer ? "purchaser" : "vendor"} size={11} />}
      label={isBuyer ? "Buyer" : "Seller"}
    />
  );
}

// ── Fallback (manual-handoff) chip ──────────────────────────────────────────
// Per-fallback-kind chip text + tooltip. Was duplicated verbatim in both
// AgentRemindersList and RemindersSection; single source of truth now here.
export function fallbackChipText(kind: string): string {
  switch (kind) {
    case "client_opted_out":          return "Opted out, chase manually";
    case "max_chases_exhausted":      return "Chased twice (manual)";
    case "days_cap_exhausted":        return "14d silent (manual)";
    case "no_email_on_contact":       return "Add email to send updates";
    case "no_portalToken_on_contact": return "Portal access needed";
    case "client_emails_paused":      return "Client emails paused (manual)";
    default:                          return "Manual handoff";
  }
}
export function fallbackChipTitle(kind: string): string {
  switch (kind) {
    case "client_opted_out":
      return "This client opted out of automated updates. Follow up manually.";
    case "max_chases_exhausted":
      return "We chased the client twice with no response. Follow up manually.";
    case "days_cap_exhausted":
      return "Client has been silent for 14 days since the first chase. Manual chase needed.";
    case "no_email_on_contact":
      return "We can't send this client automated updates yet. Add an email to switch chasing back on, or follow up manually.";
    case "no_portalToken_on_contact":
      return "This client has no portal access yet, so we can't send automated updates. Follow up manually.";
    case "client_emails_paused":
      return "Client emails are paused on this file. Chase manually if needed.";
    default:
      return "Manual chase needed.";
  }
}

// "Manual" — the system isn't chasing this one, it's the agent's. Coral so it
// stands out against the calmer autopilot rows.
export function ManualPill() {
  return <StatusPill tone="brand" icon={<HandTap size={11} weight="bold" />} label="Manual" />;
}

export function FallbackPill({ kind }: { kind: string }) {
  return (
    <StatusPill
      tone="warning"
      icon={<HandTap size={11} weight="bold" />}
      label={fallbackChipText(kind)}
      title={fallbackChipTitle(kind)}
    />
  );
}

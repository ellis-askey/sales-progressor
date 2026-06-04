// Shared comms-display helpers. Extracted from
// components/activity/ActivityTimeline.tsx so the same channel-badge
// and author-pill rendering can be reused by the ArchivedRoundDrawer
// without re-implementing it (Drawer comms were previously rendering
// raw enum strings like "internal_note"). Both surfaces accept a
// structurally-compatible row shape — `CommBadgeInput` is the minimal
// contract.

import { extractFirstName } from "@/lib/contacts/displayName";

export type CommBadgeInput = {
  type: string;
  method: string | null;
  isAutomated: boolean;
};

export type BadgeInfo = { label: string; icon: string; bg: string; color: string };

const BADGE_LABELS: Record<string, [string, string]> = {
  // [outbound, inbound]
  email:     ["Outbound email",    "Inbound email"],
  phone:     ["Outbound call",     "Inbound call"],
  sms:       ["Outbound SMS",      "Inbound SMS"],
  voicemail: ["Voicemail left",    "Voicemail received"],
  whatsapp:  ["WhatsApp sent",     "WhatsApp received"],
  post:      ["Letter sent",       "Letter received"],
};

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉", phone: "☎", sms: "💬", voicemail: "📱", whatsapp: "💚", post: "📮",
};

export function getCommBadge(entry: CommBadgeInput): BadgeInfo {
  if (entry.isAutomated) {
    return { label: "System email", icon: "✉", bg: "rgba(99,102,241,0.1)", color: "#4f46e5" };
  }
  if (entry.type === "internal_note") {
    return { label: "Internal note", icon: "📝", bg: "rgba(217,119,6,0.1)", color: "#d97706" };
  }
  const isOut = entry.type === "outbound";
  const bg    = isOut ? "rgba(255,107,74,0.1)"  : "rgba(16,185,129,0.1)";
  const color = isOut ? "var(--agent-coral)"    : "#059669";
  const key   = entry.method ?? "email";
  const [outLabel, inLabel] = BADGE_LABELS[key] ?? ["Outbound", "Inbound"];
  return { label: isOut ? outLabel : inLabel, icon: CHANNEL_ICONS[key] ?? "•", bg, color };
}

export function AuthorPill({ name, role }: { name: string | null; role?: string | null }) {
  const first = name ? extractFirstName(name) : "System";
  const isSP = role === "sales_progressor" || role === "admin";
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10,
      background: "rgba(15,23,42,0.08)", color: "var(--agent-text-muted)",
    }}>
      {isSP ? `${first} · SP` : first}
    </span>
  );
}

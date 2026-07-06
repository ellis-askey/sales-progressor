"use client";

// Overview restyle 2026-07-03 — activity feed with date-band grouping
// and Phosphor icons per event kind. Reads the same ActivityEntry[] as
// before; only the visual layer changed.
//
// Bands: TODAY / YESTERDAY / 2 DAYS AGO / X DAYS AGO / weekly bucket
// for anything older than a week.
//
// Icon map:
//   milestone confirmed  → CheckCircle
//   milestone skipped    → MinusCircle
//   internal note        → NoteBlank
//   outbound email       → EnvelopeSimple
//   outbound phone/vm    → Phone
//   outbound sms/wapp    → ChatCircleText
//   inbound *            → same icon as outbound, tint shifts
//   fallback             → Circle

import type { ReactNode } from "react";
import { useTabContext } from "./TabContext";
import {
  CheckCircle,
  MinusCircle,
  NoteBlank,
  EnvelopeSimple,
  Phone,
  ChatCircleText,
  Circle,
} from "@phosphor-icons/react";
import type { ActivityEntry } from "@/lib/services/comms";
import type { Icon } from "@phosphor-icons/react";

type Props = {
  entries: ActivityEntry[];
};

type EnrichedEntry = {
  entry: ActivityEntry;
  when: Date;
  bandKey: string;
  bandLabel: string;
};

function bandFor(when: Date): { key: string; label: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfEvent.getTime()) / 86400000);
  if (diffDays <= 0) return { key: "today",     label: "Today" };
  if (diffDays === 1) return { key: "yesterday", label: "Yesterday" };
  if (diffDays < 7)   return { key: `d${diffDays}`, label: `${diffDays} days ago` };
  if (diffDays < 14)  return { key: "last-week",  label: "Last week" };
  if (diffDays < 30)  return { key: `w${Math.floor(diffDays / 7)}`, label: `${Math.floor(diffDays / 7)} weeks ago` };
  return { key: "older", label: "Older" };
}

function iconFor(entry: ActivityEntry): { Icon: Icon; color: string; bg: string } {
  if (entry.kind === "milestone") {
    if (entry.isNotRequired) return { Icon: MinusCircle, color: "#475569", bg: "rgba(100, 116, 139, 0.10)" };
    return { Icon: CheckCircle, color: "#047857", bg: "rgba(16, 185, 129, 0.10)" };
  }
  // comm
  if (entry.type === "internal_note") {
    return { Icon: NoteBlank, color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.10)" };
  }
  const inbound = entry.type === "inbound";
  const baseColor = inbound ? "#047857" : "var(--agent-coral-deep)";
  const baseBg = inbound ? "rgba(16, 185, 129, 0.10)" : "rgba(var(--agent-coral-rgb), 0.10)";
  if (entry.method === "email") return { Icon: EnvelopeSimple, color: baseColor, bg: baseBg };
  if (entry.method === "phone" || entry.method === "voicemail") return { Icon: Phone, color: baseColor, bg: baseBg };
  if (entry.method === "sms" || entry.method === "whatsapp") return { Icon: ChatCircleText, color: baseColor, bg: baseBg };
  return { Icon: Circle, color: baseColor, bg: baseBg };
}

function titleFor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") {
    return entry.isNotRequired ? "Step marked not required" : "Step confirmed";
  }
  if (entry.type === "internal_note") return "Internal note";
  const direction = entry.type === "outbound" ? "Sent" : "Received";
  const method = entry.method === "email" ? "email"
    : entry.method === "phone" ? "call"
    : entry.method === "voicemail" ? "voicemail"
    : entry.method === "sms" ? "SMS"
    : entry.method === "whatsapp" ? "WhatsApp"
    : entry.method === "post" ? "post"
    : "message";
  return `${direction} ${method}`;
}

function subtitleFor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") return entry.milestoneName;
  return entry.content;
}

export function RecentActivityWidget({ entries }: Props) {
  const { setActiveTab } = useTabContext();
  const recent = entries.slice(0, 5);

  const enriched: EnrichedEntry[] = recent.map((entry) => {
    const when = entry.kind === "milestone"
      ? (entry.at ? new Date(entry.at) : new Date())
      : new Date(entry.at);
    const band = bandFor(when);
    return { entry, when, bandKey: band.key, bandLabel: band.label };
  });

  // Group by band, preserving order (input is already reverse-chronological).
  const bands: Array<{ key: string; label: string; items: EnrichedEntry[] }> = [];
  for (const e of enriched) {
    const last = bands[bands.length - 1];
    if (last && last.key === e.bandKey) {
      last.items.push(e);
    } else {
      bands.push({ key: e.bandKey, label: e.bandLabel, items: [e] });
    }
  }

  // 2026-07-06 restyle pass 2 — lighter container. Solid white surface
  // with a soft border, no strong glass elevation, tighter spacing.
  return (
    <div style={{
      background: "var(--agent-surface-elevated)",
      border: "0.5px solid rgba(15, 23, 42, 0.06)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Activity</h3>
        <button onClick={() => setActiveTab("activity")} className="agent-link" style={{ fontSize: 11 }}>
          View all →
        </button>
      </div>

      {recent.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>No activity yet</p>
        </div>
      ) : (
        <div>
          {bands.map((band) => (
            <div key={band.key}>
              <div style={{
                padding: "8px 16px 4px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--agent-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>{band.label}</div>
              {band.items.map(({ entry, when }) => {
                const { Icon: EntryIcon, color, bg } = iconFor(entry);
                const title = titleFor(entry);
                const subtitle = subtitleFor(entry);
                const isInternal = entry.kind === "comm" && entry.type === "internal_note";
                return (
                  <ActivityRow
                    key={entry.id}
                    IconEl={<EntryIcon size={14} weight="regular" />}
                    iconColor={color}
                    iconBg={bg}
                    title={title}
                    subtitle={subtitle}
                    time={when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    trailingTag={isInternal ? "Internal note" : null}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  IconEl, iconColor, iconBg, title, subtitle, time, trailingTag,
}: {
  IconEl: ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  time: string;
  trailingTag: string | null;
}) {
  return (
    <div className="agent-hover-row" style={{
      padding: "8px 16px",
      borderTop: "0.5px solid var(--agent-border-default)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 7,
        background: iconBg,
        color: iconColor,
        flexShrink: 0,
      }}>{IconEl}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</span>
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>{time}</span>
          {trailingTag && (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--agent-text-secondary)",
              background: "rgba(15, 23, 42, 0.06)",
              borderRadius: 4,
              padding: "1px 6px",
              marginLeft: "auto",
            }}>{trailingTag}</span>
          )}
        </div>
        <p style={{
          margin: "2px 0 0",
          fontSize: 11,
          color: "var(--agent-text-secondary)",
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>{subtitle}</p>
      </div>
    </div>
  );
}

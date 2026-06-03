"use client";

// Per-contact "when did we last reach out to this person" pill, shown on
// the secondary line of each contact row on /agent/transactions/[id].
// Outbound-only by design (see getLastContactedByContact in
// lib/services/comms.ts for what counts vs what doesn't).
//
// Bands (calendar days in Europe/London — NOT rolling 24h windows; a
// message sent at 16:30 yesterday must read "yesterday" the moment the
// UK clock crosses midnight, not 24h later):
//   same UK day    green dot, "Contacted today"
//   1-21d ago      neutral grey, "Contacted Nd ago" / "Contacted Nw ago"
//   > 21d ago      amber dot, "Last contacted Nw ago"
//   never          muted grey + dashed border, "Not contacted yet"

import { toUKDateStr } from "@/lib/utils";

type Props = {
  // ISO string from the server, or null/undefined for "never". Component
  // is a pure formatter so it stays cheap inside the row map.
  lastContactedAt: string | null | undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ukCalendarDaysSince(lastContactedAt: string, now: Date): number {
  const todayStr = toUKDateStr(now);
  const lastStr = toUKDateStr(new Date(lastContactedAt));
  // Anchor both as UTC midnight so DST transitions don't shift the diff.
  const t0 = Date.parse(`${todayStr}T00:00:00Z`);
  const t1 = Date.parse(`${lastStr}T00:00:00Z`);
  return Math.round((t0 - t1) / DAY_MS);
}

function formatRelative(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1w ago";
  if (days < 60) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function LastContactedPill({ lastContactedAt }: Props) {
  if (!lastContactedAt) {
    return (
      <span
        title="No outbound contact recorded yet for this contact"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "1px 8px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 500,
          color: "var(--agent-text-muted)",
          background: "transparent",
          border: "1px dashed rgba(15,23,42,0.18)",
          lineHeight: 1.5,
        }}
      >
        Not contacted yet
      </span>
    );
  }

  const days = ukCalendarDaysSince(lastContactedAt, new Date());
  const isFresh = days <= 0;
  const isStale = days > 21;

  const dotColour = isFresh
    ? "var(--agent-success)"
    : isStale
      ? "var(--agent-warning)"
      : "rgba(15,23,42,0.35)";
  const textColour = isStale
    ? "var(--agent-warning)"
    : "var(--agent-text-muted)";
  const bg = isStale
    ? "rgba(var(--agent-warning-rgb), 0.10)"
    : "rgba(15,23,42,0.05)";

  const prefix = isStale ? "Last contacted" : "Contacted";
  const label = isFresh ? "today" : formatRelative(days);

  return (
    <span
      title={`${prefix} ${new Date(lastContactedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 500,
        color: textColour,
        background: bg,
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColour,
          flexShrink: 0,
        }}
      />
      {prefix} {label}
    </span>
  );
}

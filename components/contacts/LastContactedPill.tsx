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
import { Pill } from "@/components/ui/Pill";

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
      <Pill
        tone="muted"
        size="sm"
        outline
        title="No outbound contact recorded yet for this contact"
        style={{ borderStyle: "dashed" }}
      >
        Not contacted yet
      </Pill>
    );
  }

  const days = ukCalendarDaysSince(lastContactedAt, new Date());
  const isFresh = days <= 0;
  const isStale = days > 21;

  // Fresh reads positive (green), stale needs the amber nudge, everything in
  // between stays quiet grey. The leading dot inherits the tone colour.
  const tone: "success" | "warning" | "muted" = isFresh ? "success" : isStale ? "warning" : "muted";
  const prefix = isStale ? "Last contacted" : "Contacted";
  const label = isFresh ? "today" : formatRelative(days);

  return (
    <Pill
      glass
      dot
      tone={tone}
      size="sm"
      title={`${prefix} ${new Date(lastContactedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`}
    >
      {prefix} {label}
    </Pill>
  );
}

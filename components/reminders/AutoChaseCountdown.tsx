"use client";

// Live "the system will chase this next at…" line for autopilot rows. Renders a
// stable placeholder on the server ("On autopilot") and starts ticking after
// mount, so there's no hydration mismatch and the time shows in the viewer's
// local zone. `iso` is the next-send instant from resolveAutopilot.

import { useState, useEffect } from "react";
import { Clock } from "@phosphor-icons/react";

// "tomorrow at 10:30am" — day + time, no live clock. Shared with the preview
// modal so the "Auto-chase {sendMoment}" wording matches the countdown.
export function sendMoment(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = target.toDateString() === now.toDateString()
    ? "today"
    : target.toDateString() === tomorrow.toDateString()
      ? "tomorrow"
      : target.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = target
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([ap])m/i, (_m, p) => p.toLowerCase() + "m");
  return `${day} at ${time}`;
}

// Returns the detail AFTER the "Auto-chase" label (the label is rendered
// separately so it can be weighted). Over 48h out, the countdown switches to a
// days breakdown ("5d 21h 15m 09s") rather than a huge hour count.
function build(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  let s = Math.floor((target.getTime() - now.getTime()) / 1000);
  if (s < 0) s = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  let clock: string;
  if (s > 48 * 3600) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    clock = `${d}d ${h}h ${pad(m)}m ${pad(sec)}s`;
  } else {
    const h = Math.floor(s / 3600);
    clock = h > 0 ? `${h}h ${pad(m)}m ${pad(sec)}s` : `${m}m ${pad(sec)}s`;
  }
  return `${sendMoment(iso)} · ${clock}`;
}

export function AutoChaseCountdown({ iso, onView, pausedUntil }: { iso: string; onView?: () => void; pausedUntil?: string | null }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    // Client asked us to hold until a date: still automated, just waiting — show a
    // static "resumes <date>" line, not a ticking countdown (which would read as a
    // giant hour count for a hold weeks out, and imply active chasing).
    if (pausedUntil) {
      setText(`Client asked us to hold · resumes ${sendMoment(pausedUntil)}`);
      return;
    }
    const update = () => setText(build(iso));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [iso, pausedUntil]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7, marginTop: 8,
      padding: "6px 10px", borderRadius: 9,
      background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border-strong)",
      fontSize: 11.5, color: "var(--agent-text-secondary)",
    }}>
      <Clock size={12} weight="bold" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {text == null
          ? "On autopilot"
          : pausedUntil
            ? text
            : <><span style={{ fontWeight: 500 }}>Auto-chase</span> {text}</>}
      </span>
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="acc-view-btn"
          style={{
            marginLeft: "auto", flexShrink: 0,
            background: "none", border: "none", cursor: "pointer", padding: "0 2px",
            fontSize: 11.5, fontWeight: 700, color: "var(--agent-success)",
            transition: "opacity 120ms ease",
          }}
        >
          View
        </button>
      )}
    </div>
  );
}

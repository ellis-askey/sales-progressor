"use client";

// Live "the system will chase this next at…" line for autopilot rows. Renders a
// stable placeholder on the server ("On autopilot") and starts ticking after
// mount, so there's no hydration mismatch and the time shows in the viewer's
// local zone. `iso` is the next-send instant from resolveAutopilot.

import { useState, useEffect } from "react";
import { Clock } from "@phosphor-icons/react";

function build(iso: string): string {
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
  let s = Math.floor((target.getTime() - now.getTime()) / 1000);
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const clock = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`
    : `${m}m ${String(sec).padStart(2, "0")}s`;
  return `Auto-chase ${day} at ${time} · ${clock}`;
}

export function AutoChaseCountdown({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setText(build(iso));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [iso]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7, marginTop: 8,
      padding: "6px 10px", borderRadius: 9,
      background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border-strong)",
      fontSize: 11.5, color: "var(--agent-text-secondary)",
    }}>
      <Clock size={12} weight="bold" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{text ?? "On autopilot"}</span>
    </div>
  );
}

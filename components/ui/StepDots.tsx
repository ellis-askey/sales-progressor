import type { CSSProperties } from "react";

// Canonical step / progress dots — filled coral for completed steps, hollow for
// the rest. The active step can widen into a short coral pill (the welcome-modal
// treatment) to read as "you are here". Extracted from the automated-emails
// cockpit's chase-progress dots ("chase 2 of 2"). For a continuous percentage
// use ProgressBar / ProgressRing; this is for a small, countable number of steps.

export function StepDots({
  done,
  total,
  widenActive = false,
  style,
}: {
  done: number;
  total: number;
  /** Widen the current (last completed) step into a coral pill. */
  widenActive?: boolean;
  style?: CSSProperties;
}) {
  const n = Math.max(total, done);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, ...style }}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: widenActive && i === done - 1 ? 14 : 6,
            height: 6,
            borderRadius: 999,
            background: i < done ? "var(--agent-coral)" : "var(--agent-border-default)",
            transition: "width .2s ease",
          }}
        />
      ))}
    </span>
  );
}

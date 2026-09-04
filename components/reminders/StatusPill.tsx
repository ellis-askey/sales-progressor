// A reminder status pill: the canonical Pill shape + a leading icon + a label
// that collapses to icon-only on narrow screens (the full label is kept as a
// tooltip via `title`, so nothing is lost). Used by BOTH the Reminders page and
// the property-file Reminders tab so the urgency / side chips are identical
// everywhere. See .rem-pill-label in app/agent/styles/agent-system.css for the
// breakpoint.

import type { ReactNode } from "react";
import { Pill, type PillProps } from "@/components/ui/Pill";

export function StatusPill({
  tone,
  icon,
  label,
  size = "sm",
  glass = true,
  title,
}: {
  tone?: PillProps["tone"];
  icon: ReactNode;
  label: string;
  size?: PillProps["size"];
  glass?: boolean;
  title?: string;
}) {
  return (
    <Pill tone={tone} size={size} glass={glass} title={title ?? label}>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span className="rem-pill-label">{label}</span>
    </Pill>
  );
}

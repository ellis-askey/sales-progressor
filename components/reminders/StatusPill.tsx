// A reminder status pill: the canonical Pill shape + a leading icon + a label
// that collapses to icon-only on narrow screens (the full label is kept as a
// tooltip via `title`, so nothing is lost). Used by BOTH the Reminders page and
// the property-file Reminders tab so the urgency / side chips are identical
// everywhere. See .rem-pill-label in app/agent/styles/agent-system.css for the
// breakpoint.
//
// De-tinted (2026-11-22, founder-approved): default is now the OUTLINE Pill —
// a tone border + tone text, no soft fill — in line with the app-wide
// "no faded colour fills" rule. Pass `glass` to opt back into the tinted look.

import type { ReactNode } from "react";
import { Pill, type PillProps } from "@/components/ui/Pill";

export function StatusPill({
  tone,
  icon,
  label,
  size = "sm",
  glass = false,
  title,
  className,
}: {
  tone?: PillProps["tone"];
  icon: ReactNode;
  label: ReactNode;
  size?: PillProps["size"];
  glass?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <Pill tone={tone} size={size} glass={glass} outline={!glass} className={className} title={title ?? (typeof label === "string" ? label : undefined)}>
      <span className="rem-pill-icon" style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span className="rem-pill-label">{label}</span>
    </Pill>
  );
}

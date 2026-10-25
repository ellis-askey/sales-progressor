"use client";

// SectionDisclosure — the canonical "free section bar + free cards" collapsible,
// lifted from the work-queue (components/reminders/AgentRemindersList.tsx, the
// "Needs you" / "On autopilot" bars). A slim standalone bar is the clickable
// header; its body is a TRANSPARENT accordion whose children are standalone
// cards sitting free at full width — NOT nested inside an enclosing card.
//
// This replaces the older "outer GlassCard wraps the inner cards" pattern
// (Completions, Updates, …) that read as cards-inside-a-card and, on mobile,
// cost the inner cards width to the outer card's padding.
//
// Mechanics (all pre-existing CSS in app/agent/styles/agent-system.css):
//   - .agent-wq-secbar     — the neutral glass bar (status reads from the label
//                            text colour, not a bar wash)
//   - .agent-acc / .open   — the grid-rows 1fr↔0fr collapse animation
//   - .wq-acc > .agent-acc-in — widens the clip box so card shadows aren't
//                            clipped left/right while collapsing
//
// Controlled: the parent owns `open` + `onToggle`, so a page can keep several
// sections' state (and deep-link / default-open logic) in one place.

import { type ReactNode, type KeyboardEvent } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { useRevealStagger } from "@/lib/agent/use-reveal-stagger";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import type { GlassPick } from "@/lib/glass/variants";

export function SectionDisclosure({
  label,
  count,
  countTone = "muted",
  labelClassName,
  sub,
  right,
  open,
  onToggle,
  id,
  glassId,
  glassLabel,
  glassBaseline,
  children,
}: {
  label: ReactNode;
  /** Outline count badge (mirrors the work-queue). Omit to hide. */
  count?: number;
  countTone?: "coral" | "muted";
  /** Colour class for the label (e.g. an urgency `text-red-600`). When set it
   *  carries the label colour; otherwise the label is the standard secondary. */
  labelClassName?: string;
  /** Muted helper text beside the label; hidden on the narrowest screens. */
  sub?: ReactNode;
  /** Right-aligned slot before the caret (e.g. a fees summary). */
  right?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Anchor id for in-page deep links (e.g. `section-overdue`). */
  id?: string;
  /** Opt-in Design Lab tag for the bar (per consumer). No visual change until
   *  a variant is picked. */
  glassId?: string;
  glassLabel?: string;
  /** Baked default look for the bar (per consumer), applied until a pick exists. */
  glassBaseline?: GlassPick;
  children: ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  // On expand (not first mount), the cards/rows bloom in one at a time —
  // the page load-in, fired on reveal. See useRevealStagger.
  const revealRef = useRevealStagger<HTMLDivElement>(open);
  const tag = useGlassTag(glassId ?? "", glassLabel ?? "Section bar", glassBaseline);

  return (
    <div className="space-y-2" id={id} style={id ? { scrollMarginTop: 80 } : undefined}>
      <div
        className={`agent-wq-secbar flex items-center justify-between px-3 py-2 rounded-xl${glassId ? ` ${tag.className}` : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        {...(glassId ? tag.props : {})}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <span
            className={labelClassName}
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              ...(labelClassName ? {} : { color: "var(--agent-text-secondary)" }),
            }}
          >
            {label}
          </span>
          {typeof count === "number" && (
            <span className={`agent-wq-count agent-wq-count--${countTone}`}>{count}</span>
          )}
          {sub && (
            <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
              {sub}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {right}
          <CaretDown
            size={12}
            weight="bold"
            aria-hidden
            style={{
              flexShrink: 0,
              color: "var(--agent-text-muted)",
              transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>
      </div>

      <div className={`agent-acc wq-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          {/* Free cards: full width, 12px apart, 40px bottom so the last card's
              soft shadow isn't clipped by the accordion's overflow. On expand,
              the children bloom in one at a time (revealRef). */}
          <div ref={revealRef} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 40px" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

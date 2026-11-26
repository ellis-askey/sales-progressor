"use client";

// Canonical hub split-button — a label button joined to a RowActionMenu caret. Extracted
// 2026-11-21 from the hub attention cards that each hand-joined agent-btn +
// RowActionMenu (Chase, Take off hold, Done). The dropdown is the existing canonical
// RowActionMenu, UNCHANGED — this only standardises the joined button + caret shell.

import type { ReactNode, CSSProperties } from "react";
import { RowActionMenu, type RowMenuItem } from "@/components/hub/RowActionMenu";
import { buttonClasses } from "@/components/arc/button/button";

/** Coral token override — keeps the primary split-button on brand (flat coral). */
const CORAL_TOKENS = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff" } as CSSProperties;

export function HubSplitButton({
  label,
  onClick,
  items,
  disabled = false,
  variant = "ghost",
  className,
  buttonStyle,
  accent,
}: {
  label: ReactNode;
  onClick: () => void;
  items: RowMenuItem[];
  disabled?: boolean;
  /** "ghost" = agent-btn-ghost-bordered (default), "primary" = agent-btn-primary. */
  variant?: "ghost" | "primary";
  /** Extra class on the inline-flex wrapper (e.g. the row's "hub-r-actions"). */
  className?: string;
  /** Extra style on the label button, merged after the base (e.g. a tone `color`). */
  buttonStyle?: CSSProperties;
  /**
   * Solid accent fill (a colour or CSS var, e.g. "var(--agent-success)"). When set,
   * BOTH halves — the label button and the joined caret — render as one solid
   * accent-filled control with white text, instead of the default transparent
   * outline. Use for the primary confirm action on a glass surface, where an
   * outline button reads as see-through.
   */
  accent?: string;
}) {
  // A solid accent wins over the coral-primary / outline default on both halves.
  const accentTokens = accent
    ? ({ ["--foreground" as string]: accent, ["--background" as string]: "#ffffff" } as CSSProperties)
    : null;
  const solid = accent != null || variant === "primary";
  return (
    <div className={className} style={{ display: "inline-flex", flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={buttonClasses({ variant: solid ? "primary" : "outline", size: "sm" })}
        style={{ gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0, ...(variant === "primary" ? CORAL_TOKENS : null), ...accentTokens, ...buttonStyle }}
      >
        {label}
      </button>
      <RowActionMenu joined disabled={disabled} items={items} accent={accent} />
    </div>
  );
}

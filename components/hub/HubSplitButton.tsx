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
}) {
  return (
    <div className={className} style={{ display: "inline-flex", flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={buttonClasses({ variant: variant === "primary" ? "primary" : "outline", size: "sm" })}
        style={{ gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0, ...(variant === "primary" ? CORAL_TOKENS : null), ...buttonStyle }}
      >
        {label}
      </button>
      <RowActionMenu joined disabled={disabled} items={items} />
    </div>
  );
}

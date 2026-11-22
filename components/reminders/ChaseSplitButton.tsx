"use client";

// The reminders "Deck" primary action: a Chase split-button. The main button
// chases (opens the chase drawer); the attached chevron opens a small menu with
// the two secondary actions that used to sit inline — Mark chased and Mark done.
// Snooze stays a separate button.
//
// Rebuilt on the canonical arc Button (flat coral primary via token override),
// replacing the bespoke .rem-chase CSS, so the Chase CTA is a library component
// (founder-approved flatten, 2026-11-22). The chevron menu rides the canonical
// Popover primitive (portal + flip/shift + edge gutter + locked glass). Used by
// AgentRemindersList.
//
// `solo` renders just the chase button (no chevron/menu) for callers with no
// mark-chased/done equivalent. The file-level "Chase all" passes batch handlers
// + "Mark all chased"/"Mark all done" labels instead.

import type { CSSProperties } from "react";
import { CaretDown, ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { buttonClasses } from "@/components/arc/button/button";

// Flat coral primary via the arc Button's ink/slab token override (same pattern
// as every other coral CTA in the catalogue — the component itself is untouched).
const CORAL_PRIMARY: CSSProperties = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#fff" };

export function ChaseSplitButton({
  label = "Chase",
  onChase,
  onMarkChased,
  onMarkDone,
  markChasedLabel = "Mark chased",
  markDoneLabel = "Mark done",
  disabled = false,
  solo = false,
}: {
  label?: string;
  onChase: () => void;
  onMarkChased?: () => void;
  onMarkDone?: () => void;
  markChasedLabel?: string;
  markDoneLabel?: string;
  disabled?: boolean;
  solo?: boolean;
}) {
  const caretBtn = (
    <button
      type="button"
      className={buttonClasses({ variant: "primary", size: "sm" })}
      style={{ ...CORAL_PRIMARY, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(255,255,255,0.32)", padding: "0 7px" }}
      disabled={disabled}
      aria-label="More chase actions"
    >
      <CaretDown size={12} weight="bold" />
    </button>
  );

  return (
    // rem-chase-split carries only the mobile full-width layout (agent-system.css);
    // all visual styling now comes from the canonical arc Button.
    <div style={{ position: "relative", flexShrink: 0 }}>
      <span className="rem-chase-split" style={{ display: "inline-flex", opacity: disabled ? 0.5 : 1 }}>
        <button
          type="button"
          className={buttonClasses({ variant: "primary", size: "sm" })}
          style={{ ...CORAL_PRIMARY, ...(solo ? {} : { borderTopRightRadius: 0, borderBottomRightRadius: 0 }) }}
          onClick={onChase}
          disabled={disabled}
        >
          {label}
        </button>
        {!solo && (
          // A disabled caret must not open — render it bare (the Popover anchor
          // would otherwise still toggle on click).
          disabled ? caretBtn : (
            <Popover preset="menu" placement="bottom-end" trigger={caretBtn}>
              {(close) => (
                <>
                  <PopoverMenuItem
                    icon={<ArrowClockwise size={15} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />}
                    onClick={() => { onMarkChased?.(); close(); }}
                  >
                    {markChasedLabel}
                  </PopoverMenuItem>
                  <PopoverMenuItem
                    icon={<CheckCircle size={15} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />}
                    onClick={() => { onMarkDone?.(); close(); }}
                  >
                    {markDoneLabel}
                  </PopoverMenuItem>
                </>
              )}
            </Popover>
          )
        )}
      </span>
    </div>
  );
}

"use client";

// The reminders "Deck" primary action: a Chase split-button. The main button
// chases (opens the chase drawer); the attached chevron opens a small menu with
// the two secondary actions that used to sit inline — Mark chased and Mark done.
// Snooze stays a separate button. Purely a reorganisation of the same actions;
// no behaviour changes. The chevron menu rides the canonical Popover primitive
// (portal + flip/shift + edge gutter + locked glass + neutral Lift hover). Split-
// button styling in agent-system.css (.rem-chase*). Used by AgentRemindersList.
//
// `solo` renders just the chase button (no chevron/menu) for callers with no
// mark-chased/done equivalent. The file-level "Chase all" passes batch
// handlers + "Mark all chased"/"Mark all done" labels instead (founder ask,
// 2026-09-23).

import { CaretDown, ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";

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
      className="rem-chase-caret"
      disabled={disabled}
      aria-label="More chase actions"
    >
      <CaretDown size={12} weight="bold" />
    </button>
  );

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <span className={`rem-chase${solo ? " solo" : ""}${disabled ? " is-disabled" : ""}`}>
        <button type="button" className="rem-chase-go" onClick={onChase} disabled={disabled}>
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

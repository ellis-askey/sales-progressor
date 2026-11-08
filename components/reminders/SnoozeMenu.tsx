"use client";

// Shared snooze popover for every reminder surface (Reminders page rows +
// "Snooze all", and the property-file Reminders tab). Replaces the three
// near-identical bespoke menus that only offered quick durations.
//
// Adds: an optional reason (logged against the reminder + posted to the file's
// Activity tab by the snooze action), and a "pick a date" alternative to the
// quick gaps. Rides the canonical Popover primitive (portal + flip/shift + edge
// gutter + locked glass surface); the Popover never dismisses on scroll, which
// is what the reason field needs on mobile when the keyboard scrolls the window
// (was critique #276, previously hand-handled).

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Popover } from "@/components/ui/Popover";
import { BellSimpleZ } from "@phosphor-icons/react";
// Pure date helpers (client-safe) — mirror the server's wake maths so the
// subtext can preview the exact morning the reminder resurfaces.
import { addWorkingDays, rollToWorkingDay } from "@/lib/emails/working-hours";

export interface SnoozeChoice {
  hours?: number;
  untilISO?: string;
  reason: string | null;
}

// Day-based labels (critique #281): the wake maths always lands at 06:00 UK on
// the target morning (and rolls off weekends/bank holidays), so hour labels
// ("24 h") described something that never literally happened. The hour values
// stay as the wire format — snoozeReminderLog turns them into mornings.
const QUICK = [
  { label: "Tomorrow", hours: 24 },
  { label: "In 2 days", hours: 48 },
  { label: "In 3 days", hours: 72 },
  { label: "Next week", hours: 168 },
];

export function SnoozeMenu({
  onConfirm,
  disabled,
  variant = "row",
  label = "Snooze all",
  count,
  subtextVerb = "Comes back",
}: {
  onConfirm: (choice: SnoozeChoice) => void;
  disabled?: boolean;
  variant?: "row" | "all" | "icon";
  label?: string;
  count?: number;
  // "icon" variant: the verb for the subtext ("Comes back" for a reminder,
  // "Sends" for a chase). Default reads as a reminder resurfacing.
  subtextVerb?: string;
}) {
  const [hours, setHours] = useState<number | null>(null);
  const [dateVal, setDateVal] = useState("");
  const [reason, setReason] = useState("");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const canConfirm = !!hours || !!dateVal;

  // Clear the fields each time the popover opens (fires on the trigger click).
  function reset() { setHours(null); setDateVal(""); setReason(""); }

  const triggerBtn = variant === "icon" ? (
    // Compact icon trigger (the file's Next-action card): a snooze bell.
    <button
      type="button"
      onClick={reset}
      disabled={disabled}
      title="Snooze"
      aria-label="Snooze"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, cursor: "pointer", color: "var(--agent-text-secondary)", background: "transparent", border: "none", transition: "background 140ms ease" }}
      className="agent-hover-row"
    >
      <BellSimpleZ size={16} weight="regular" />
    </button>
  ) : (
    <Button
      onClick={reset}
      disabled={disabled}
      title="Snooze"
      variant={variant === "all" ? "ghost" : "secondary"}
      size="sm"
      className="rem-clock-btn"
      style={{ flexShrink: 0, whiteSpace: "nowrap" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <line x1="12" y1="12" x2="15" y2="12" />
        <g className="rem-clock-hand"><line x1="12" y1="12" x2="12" y2="6.5" /></g>
      </svg>
      {variant === "all" ? ` ${label}${count ? ` (${count})` : ""}` : null}
    </Button>
  );

  // A disabled trigger must not open — render it bare (the Popover anchor would
  // otherwise still toggle on click).
  if (disabled) return triggerBtn;

  return (
    <Popover preset="popover" placement="bottom-end" width={232} trigger={triggerBtn}>
      {(close) => {
        function confirm() {
          if (!hours && !dateVal) return;
          onConfirm(dateVal ? { untilISO: dateVal, reason: reason.trim() || null } : { hours: hours ?? 24, reason: reason.trim() || null });
          close();
        }
        // Preview the exact morning it resurfaces — same working-day maths the
        // snooze action runs server-side (quick gaps count working days; a
        // weekend/bank-holiday pick rolls to the next working morning).
        const quickDays = hours != null ? (hours >= 168 ? 5 : Math.max(1, Math.round(hours / 24))) : 1;
        const wakeBase = dateVal ? new Date(`${dateVal}T12:00:00Z`) : addWorkingDays(new Date(), quickDays);
        const wakeLabel = (hours || dateVal)
          ? rollToWorkingDay(wakeBase).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
          : null;
        return (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--agent-text-muted)", textTransform: "uppercase" }}>
              Snooze until
            </p>

            {/* Quick gaps */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {QUICK.map((opt) => {
                const on = hours === opt.hours && !dateVal;
                return (
                  <button
                    key={opt.hours}
                    onClick={() => { setHours(opt.hours); setDateVal(""); }}
                    className={`rem-snz-chip${on ? " on" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Or a specific date */}
            <DateField
              value={dateVal}
              min={tomorrow}
              onChange={(e) => { setDateVal(e.target.value); setHours(null); }}
              className="agent-input agent-input-sm"
              style={{ width: "100%", fontSize: 12 }}
              wrapperStyle={{ marginBottom: 10 }}
            />

            {/* Optional reason */}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (optional)"
              rows={2}
              className="agent-textarea"
              style={{ width: "100%", fontSize: 12, resize: "none", marginBottom: 10, lineHeight: 1.4, minHeight: 52, padding: "8px 10px" }}
            />

            <Button onClick={confirm} disabled={!canConfirm} size="sm" style={{ width: "100%" }}>
              Snooze{count && count > 1 ? ` all ${count}` : ""}
            </Button>

            {/* Wake preview — below the button, naming the real morning. */}
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.4, textAlign: "center" }}>
              {wakeLabel ? `${subtextVerb} ${wakeLabel} at 6am` : `${subtextVerb} at 6am on a working day`}
            </p>
          </>
        );
      }}
    </Popover>
  );
}

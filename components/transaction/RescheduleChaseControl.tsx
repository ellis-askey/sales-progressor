"use client";

// The Up-next date on the Chase timeline IS the reschedule control. Hovering
// slides in a small ticking clock (same animation as the reminders snooze
// button) and turns the pair primary; clicking opens a popover with a date
// picker + Save/Close. Saving writes the lane's own hold field via
// rescheduleChaseThreadAction — the field each sender already respects — so the
// chase genuinely moves and resumes by itself on the chosen morning. Rides the
// canonical Popover primitive (portal + flip/shift + edge gutter + locked
// glass); like SnoozeMenu it never dismisses on scroll, so the date field
// holds on mobile when the keyboard scrolls the window.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Popover } from "@/components/ui/Popover";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { rescheduleChaseThreadAction } from "@/app/actions/chase-timeline";

type OverrideTarget =
  | { kind: "client"; contactId: string; milestoneCode: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser"; milestoneCode: string }
  | { kind: "enquiry"; scope: "raise" | "reply"; milestoneCode: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const yearSuffix = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${yearSuffix}`;
}

export function RescheduleChaseControl({
  transactionId,
  target,
  dueAtISO,
}: {
  transactionId: string;
  target: OverrideTarget;
  dueAtISO: string;
}) {
  const { toast } = useAgentToast();
  const [dateVal, setDateVal] = useState("");
  const [saving, startSaving] = useTransition();

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentISO = dueAtISO.slice(0, 10);
  // A chase can only move LATER than the day it's already due — the hold can
  // delay a send, never conjure an earlier one.
  const minISO = currentISO > tomorrow ? currentISO : tomorrow;

  return (
    <Popover
      preset="popover"
      placement="bottom-end"
      width={248}
      trigger={
        <button
          type="button"
          className="chase-resched-btn"
          onClick={() => setDateVal("")}
          title="Move the next chase"
          aria-label={`Next chase ${fmtDate(currentISO)}. Move it to another day.`}
        >
          <span>{fmtDate(dueAtISO)}</span>
          {/* The reminders snooze clock — hand ticks on hover via .rem-clock-hand. */}
          <svg className="chase-resched-clock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="8.5" />
            <line x1="12" y1="12" x2="15" y2="12" />
            <g className="rem-clock-hand"><line x1="12" y1="12" x2="12" y2="6.5" /></g>
          </svg>
        </button>
      }
    >
      {(close) => {
        function save() {
          if (!dateVal || saving) return;
          startSaving(async () => {
            const actionTarget =
              target.kind === "client"
                ? ({ kind: "client", contactId: target.contactId } as const)
                : target.kind === "solicitor"
                  ? ({ kind: "solicitor", side: target.side } as const)
                  : ({ kind: "enquiry", scope: target.scope } as const);
            const res = await rescheduleChaseThreadAction({
              transactionId,
              target: actionTarget,
              milestoneCode: target.milestoneCode,
              dateISO: dateVal,
            });
            if (res.ok) {
              toast.success(`Next chase moved to ${fmtDate(dateVal)}`);
              close();
            } else {
              toast.error(res.error);
            }
          });
        }
        return (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--agent-text-muted)", textTransform: "uppercase" }}>
              Move next chase
            </p>

            <DateField
              value={dateVal}
              min={minISO}
              onChange={(e) => setDateVal(e.target.value)}
              className="agent-input agent-input-sm"
              style={{ width: "100%", fontSize: 12 }}
              wrapperStyle={{ marginBottom: 8 }}
            />

            <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
              Sends in the morning run on the day you pick.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={close} variant="ghost" size="sm" disabled={saving} style={{ flex: 1 }}>
                Close
              </Button>
              <Button onClick={save} size="sm" disabled={!dateVal || saving} style={{ flex: 1 }}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        );
      }}
    </Popover>
  );
}

"use client";

// Per-file automation controls panel.
//
// Visibility rules (enforced by the parent page — this component renders
// nothing on its own if shown=false):
//   - Hidden when serviceType !== "self_managed"
//   - Hidden when status is completed | withdrawn | draft
//
// Two controls:
//   1. Pause client emails toggle
//      - Off: cron enqueues digests normally
//      - On:  cron skips digest enqueue + ChaseTask gets the
//             "client_emails_paused" fallbackKind chip. Chase clock keeps
//             running underneath. Escalation still fires.
//   2. Put file on hold / Reactivate file
//      - on_hold flips PropertyTransaction.status. Cron's status="active"
//        filter auto-freezes everything. Reactivate bumps the active CCS
//        clocks (lastChasedAt + lastEngagedAt) so the unpause doesn't
//        produce a pile of overdue repeats.

import { useState, useTransition } from "react";
import { pauseClientEmails, resumeClientEmails, putFileOnHold, reactivateFile } from "@/app/actions/automation";

type Props = {
  transactionId: string;
  initialClientEmailsPaused: boolean;
  status: "active" | "on_hold";
};

export function AutomationControls({ transactionId, initialClientEmailsPaused, status }: Props) {
  const [paused, setPaused] = useState(initialClientEmailsPaused);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePause() {
    setError(null);
    const next = !paused;
    startTransition(async () => {
      const result = next ? await pauseClientEmails(transactionId) : await resumeClientEmails(transactionId);
      if (result.ok) setPaused(next);
      else setError(result.error);
    });
  }

  function toggleHold() {
    setError(null);
    startTransition(async () => {
      const result = currentStatus === "on_hold"
        ? await reactivateFile(transactionId)
        : await putFileOnHold(transactionId);
      if (result.ok) setCurrentStatus(currentStatus === "on_hold" ? "active" : "on_hold");
      else setError(result.error);
    });
  }

  const isOnHold = currentStatus === "on_hold";

  return (
    <div className="glass-card rounded-[12px] p-5">
      <h3 className="text-base font-semibold mb-1 text-[var(--agent-text-primary,#1A1D29)]">
        Automation on this file
      </h3>
      <p className="text-sm mb-4 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
        Pause automated emails or freeze the file. The team still sees this file in their reminders.
      </p>

      <div className="space-y-3">
        {/* Pause client emails */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--agent-text-primary,#1A1D29)]">
              Pause client emails
            </p>
            <p className="text-xs text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
              {paused
                ? "No automated chases will send. Reminders show as manual handoffs."
                : "Automated chases are sending as scheduled."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={paused}
            onClick={togglePause}
            disabled={isPending || isOnHold}
            className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50"
            style={{ background: paused ? "#FF6B4A" : "rgba(15,23,42,0.20)" }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: paused ? "translateX(22px)" : "translateX(4px)", marginTop: 4 }}
            />
          </button>
        </div>

        {/* On hold */}
        <div className="pt-3 border-t border-[rgba(15,23,42,0.08)] flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--agent-text-primary,#1A1D29)]">
              {isOnHold ? "File is on hold" : "Put file on hold"}
            </p>
            <p className="text-xs text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
              {isOnHold
                ? "Nothing is automated. Reactivate to resume."
                : "Freezes the whole file — no emails, no agent reminders, no escalations."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleHold}
            disabled={isPending}
            className="px-3 py-1.5 rounded-md text-sm font-semibold disabled:opacity-50"
            style={{
              background: isOnHold ? "#FF6B4A" : "transparent",
              color: isOnHold ? "white" : "var(--agent-text-primary,#1A1D29)",
              border: isOnHold ? "none" : "1px solid rgba(15,23,42,0.20)",
            }}
          >
            {isOnHold ? "Reactivate file" : "Put on hold"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-700 pt-2">{error}</p>
        )}
      </div>
    </div>
  );
}

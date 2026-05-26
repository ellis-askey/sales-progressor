"use client";

// Per-file automation banner. Single row: title + state-aware subtext on the
// left, toggle on the right. Visual rhythm matches FileHealthBanner /
// NextMilestoneWidget so it reads as part of the Overview tab, not a card
// dropped in afterwards.
//
// Three states surfaced via one toggle:
//   - ON  → automation active (paused=false, status=active)
//   - OFF → paused-only (paused=true, status=active)
//   - OFF → on-hold (status=on_hold) — also OFF on the toggle
//
// ON  → OFF opens the AutomationStopModal chooser so the agent picks WHICH
//       mode (pause-only or full hold). The toggle moves to OFF only on
//       success.
// OFF → ON resumes directly (no modal) — calls reactivateFile if currently
//       on-hold, resumeClientEmails if currently paused-only.
//
// Visibility (enforced by parent page, not here):
//   serviceType === "self_managed" AND status in {"active","on_hold"}.

import { useState, useTransition } from "react";
import {
  pauseClientEmails,
  resumeClientEmails,
  putFileOnHold,
  reactivateFile,
} from "@/app/actions/automation";
import { AutomationStopModal } from "@/components/transaction/AutomationStopModal";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Props = {
  transactionId: string;
  initialClientEmailsPaused: boolean;
  status: "active" | "on_hold";
};

type Mode = "active" | "paused" | "on_hold";

function deriveMode(paused: boolean, status: "active" | "on_hold"): Mode {
  if (status === "on_hold") return "on_hold";
  return paused ? "paused" : "active";
}

const SUBTEXT: Record<Mode, string> = {
  active: "Automated chases sending as scheduled.",
  paused: "Paused — client emails won't send. The team still sees this file in their reminders.",
  on_hold: "On hold — everything is frozen until you reactivate.",
};

export function AutomationControls({
  transactionId,
  initialClientEmailsPaused,
  status,
}: Props) {
  const [paused, setPaused] = useState(initialClientEmailsPaused);
  const [currentStatus, setCurrentStatus] = useState<"active" | "on_hold">(status);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useAgentToast();

  const mode = deriveMode(paused, currentStatus);
  const toggleOn = mode === "active";

  function handleToggleClick() {
    if (isPending) return;
    setError(null);
    if (toggleOn) {
      // ON → OFF: open chooser, server action fires inside the modal pick
      setModalOpen(true);
      return;
    }
    // OFF → ON: resume directly from whichever mode we're in
    const wasOnHold = mode === "on_hold";
    startTransition(async () => {
      const result = wasOnHold
        ? await reactivateFile(transactionId)
        : await resumeClientEmails(transactionId);
      if (result.ok) {
        setPaused(false);
        setCurrentStatus("active");
        toast.success(wasOnHold ? "File active" : "Client emails resumed");
      } else {
        setError(result.error);
        toast.error(
          wasOnHold
            ? "Couldn't reactivate file — try again"
            : "Couldn't resume client emails — try again",
        );
      }
    });
  }

  function handleChoice(choice: "pause" | "hold", plannedEndAt: Date | null) {
    setError(null);
    startTransition(async () => {
      const result =
        choice === "pause"
          ? await pauseClientEmails(transactionId)
          : await putFileOnHold(transactionId, plannedEndAt);
      if (result.ok) {
        if (choice === "pause") setPaused(true);
        else setCurrentStatus("on_hold");
        setModalOpen(false);
        toast.success(choice === "pause" ? "Client emails paused" : "File on hold");
      } else {
        setError(result.error);
        setModalOpen(false);
        toast.error(
          choice === "pause"
            ? "Couldn't pause client emails — try again"
            : "Couldn't put file on hold — try again",
        );
      }
    });
  }

  return (
    <>
      <div
        className="agent-reveal-in"
        style={{
          background: "var(--agent-surface-elevated)",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 10,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            Automation on this file
          </span>
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
            {error ?? SUBTEXT[mode]}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={toggleOn}
          onClick={handleToggleClick}
          disabled={isPending}
          className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50"
          style={{
            height: 24,
            width: 42,
            background: toggleOn ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
          }}
          aria-label={toggleOn ? "Stop automation on this file" : "Resume automation on this file"}
        >
          <span
            className="inline-block rounded-full bg-white shadow transition-transform"
            style={{
              height: 18,
              width: 18,
              marginTop: 3,
              transform: toggleOn ? "translateX(21px)" : "translateX(3px)",
            }}
          />
        </button>
      </div>

      {modalOpen && (
        <AutomationStopModal
          onPick={handleChoice}
          onClose={() => setModalOpen(false)}
          isPending={isPending}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { useTabContext } from "./TabContext";
import { AgentBanner } from "@/components/ui/AgentBanner";

type Props = {
  transactionId: string;
  // Rows that need attention right now — overdue + due_today + escalated.
  // This is what the tab badge shows.
  actionableCount: number;
  // Subset of actionableCount where nextDueDate is strictly past — used to
  // pick between "X overdue" copy and "X need attention" copy.
  overdueCount: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  // Set when the file is predicted to exchange more than two weeks past target.
  // Names the current blocker so the banner can say why, not just that.
  slip?: { predictedDateLabel: string; bottleneckName: string | null } | null;
};

// Local-time YYYY-MM-DD, so "a new day" respects the agent's timezone rather
// than UTC.
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function FileHealthBanner({ transactionId, actionableCount, overdueCount, onTrack, slip }: Props) {
  const { setActiveTab } = useTabContext();

  // Count-aware dismissal. The X hides the banner for the rest of the day, but
  // it comes back if the situation worsens (the actionable count rises above
  // what was dismissed) or a new day rolls over — a genuine "you're behind"
  // signal shouldn't be silenceable forever. Stored per file in localStorage.
  const storageKey = `fileHealthDismiss:${transactionId}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) { setDismissed(false); return; }
      const parsed = JSON.parse(raw) as { count: number; day: string };
      setDismissed(parsed.day === todayKey() && actionableCount <= parsed.count);
    } catch {
      setDismissed(false);
    }
  }, [storageKey, actionableCount]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ count: actionableCount, day: todayKey() }));
    } catch {
      /* localStorage unavailable (private mode) — just hide for this render */
    }
    setDismissed(true);
  };

  // On-hold files don't get the health banner — the OnHoldBanner above it
  // already says everything is frozen, and the at_risk/off_track signal is
  // not meaningful when time isn't ticking.
  if (onTrack === "on_hold") return null;
  if (dismissed) return null;

  // The slip warning takes precedence: it's the specific "running late" signal
  // and it names the step holding things up, so it's more useful than the
  // generic behind-schedule line. Present tense, framed as an estimate.
  if (slip) {
    return (
      <AgentBanner
        kind="danger"
        icon={<Warning size={18} weight="fill" />}
        title="Exchange is running behind"
        body={`Our latest estimate puts exchange around ${slip.predictedDateLabel}, more than two weeks after the target.${slip.bottleneckName ? ` We're currently waiting on ${slip.bottleneckName}.` : ""} This is an estimate and may change.`}
        action={
          actionableCount > 0
            ? { label: "View reminders →", onClick: () => setActiveTab("reminders") }
            : undefined
        }
        actionPlacement="top-right"
        dismissible={{ onDismiss: handleDismiss }}
      />
    );
  }

  const isBehind = onTrack === "at_risk" || onTrack === "off_track";
  if (actionableCount === 0 && !isBehind) return null;

  const isRed = actionableCount > 0 && isBehind;
  const kind = isRed ? "danger" : "warning";

  // Copy nuance: if any of the actionable rows are real-overdue (past their
  // date, never chased), use "overdue" — agents recognise that. Otherwise
  // the count is escalated / due-today only, so "need attention" is accurate.
  const title =
    actionableCount > 0
      ? overdueCount > 0
        ? `${actionableCount} reminder${actionableCount !== 1 ? "s" : ""} overdue`
        : `${actionableCount} reminder${actionableCount !== 1 ? "s" : ""} need${actionableCount === 1 ? "s" : ""} attention`
      : "This sale may be falling behind";
  const body =
    actionableCount > 0 && isBehind
      ? "This sale may also be falling behind. See what's holding it up."
      : undefined;

  return (
    <AgentBanner
      kind={kind}
      icon={<Warning size={18} weight="fill" />}
      title={title}
      body={body}
      action={
        actionableCount > 0
          ? { label: "View reminders →", onClick: () => setActiveTab("reminders") }
          : undefined
      }
      actionPlacement="inline-responsive"
      dismissible={{ onDismiss: handleDismiss }}
    />
  );
}

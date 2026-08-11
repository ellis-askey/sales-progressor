"use client";

import { Warning } from "@phosphor-icons/react";
import { useTabContext } from "./TabContext";
import { AgentBanner } from "@/components/ui/AgentBanner";

type Props = {
  // Rows that need attention right now — overdue + due_today + escalated.
  // This is what the tab badge shows.
  actionableCount: number;
  // Subset of actionableCount where nextDueDate is strictly past — used to
  // pick between "X overdue" copy and "X need attention" copy.
  overdueCount: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
};

export function FileHealthBanner({ actionableCount, overdueCount, onTrack }: Props) {
  const { setActiveTab } = useTabContext();

  // On-hold files don't get the health banner — the OnHoldBanner above it
  // already says everything is frozen, and the at_risk/off_track signal is
  // not meaningful when time isn't ticking.
  if (onTrack === "on_hold") return null;

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
      : "File may be behind schedule";
  const body =
    actionableCount > 0 && isBehind
      ? "File may be behind schedule too. Take a look."
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
    />
  );
}

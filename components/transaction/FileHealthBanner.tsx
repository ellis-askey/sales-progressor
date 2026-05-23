"use client";

import { Warning } from "@phosphor-icons/react";
import { useTabContext } from "./TabContext";
import { AgentBanner } from "@/components/ui/AgentBanner";

type Props = {
  overdueCount: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
};

export function FileHealthBanner({ overdueCount, onTrack }: Props) {
  const { setActiveTab } = useTabContext();

  // On-hold files don't get the health banner — the OnHoldBanner above it
  // already says everything is frozen, and the at_risk/off_track signal is
  // not meaningful when time isn't ticking.
  if (onTrack === "on_hold") return null;

  const isBehind = onTrack === "at_risk" || onTrack === "off_track";
  if (overdueCount === 0 && !isBehind) return null;

  const isRed = overdueCount > 0 && isBehind;
  const kind = isRed ? "danger" : "warning";

  const title =
    overdueCount > 0
      ? `${overdueCount} reminder${overdueCount !== 1 ? "s" : ""} overdue`
      : "File may be behind schedule";
  const body =
    overdueCount > 0 && isBehind
      ? "File may be behind schedule too — take a look."
      : isBehind && overdueCount === 0
      ? undefined
      : undefined;

  return (
    <AgentBanner
      kind={kind}
      icon={<Warning size={18} weight="fill" />}
      title={title}
      body={body}
      action={
        overdueCount > 0
          ? { label: "View reminders →", onClick: () => setActiveTab("reminders") }
          : undefined
      }
    />
  );
}

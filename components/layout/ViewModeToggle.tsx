"use client";

// Personal "All files / Just mine" view toggle (top bar + mobile menu). Shown only
// to a user ALLOWED to see all the agency's files (director, or a negotiator the
// director granted "All files"). The choice persists on agentPreferences and
// narrows every list via resolveAgentVisibility, so flipping it re-scopes Hub, All
// Files, Chains, Reminders, etc. at once. router.refresh() re-renders the server
// tree against the new view.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import "@/components/arc/cookie-consent/scope.css";
import { updateFileViewMode } from "@/app/actions/agent-preferences";

// Canonical segmented control (arc) — its selection glides between options on a
// morph spring (layoutId), upgraded from the old left/width transition. Arc tokens
// are mapped to the agent look + the shipped coral pill, so the control is the arc
// component without changing its appearance or the view-persistence behaviour.
const TOKENS: React.CSSProperties = {
  ["--surface-muted" as string]: "rgba(15,23,42,0.05)",
  ["--border" as string]: "var(--agent-border-default)",
  ["--text-muted" as string]: "var(--agent-text-secondary)",
  ["--foreground" as string]: "var(--agent-text-primary)",
  ["--radius-control" as string]: "11px",
  ["--control-height-sm" as string]: "28px",
  ["--text-sm" as string]: "13px",
  ["--sc-selection-bg" as string]: "var(--agent-coral-deep)",
  ["--sc-selection-fg" as string]: "var(--agent-text-on-coral)",
  ["--sc-selection-border" as string]: "transparent",
  ["--shadow-resting" as string]: "0 2px 6px rgba(255,107,74,0.30)",
};

export function ViewModeToggle({ initialMode, fullWidth = false }: { initialMode: "all" | "mine"; fullWidth?: boolean }) {
  const [mode, setMode] = useState<"all" | "mine">(initialMode);
  const [, start] = useTransition();
  const router = useRouter();

  function choose(next: string) {
    const m = next as "all" | "mine";
    if (m === mode) return;
    setMode(m); // optimistic — the pill glides immediately
    start(async () => {
      await updateFileViewMode(m);
      router.refresh();
    });
  }

  return (
    <div className="arc-scope" style={{ ...TOKENS, ...(fullWidth ? { display: "block", width: "100%" } : { display: "inline-block" }) }}>
      <SegmentedControl
        label="Show all files or just mine"
        options={[{ value: "all", label: "All" }, { value: "mine", label: "Mine" }]}
        value={mode}
        onValueChange={choose}
        fullWidth={fullWidth}
      />
    </div>
  );
}

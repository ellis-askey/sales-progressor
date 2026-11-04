"use client";

// Personal "All files / Just mine" view toggle (top bar + mobile menu). Shown only
// to a user ALLOWED to see all the agency's files (director, or a negotiator the
// director granted "All files"). The choice persists on agentPreferences and
// narrows every list via resolveAgentVisibility, so flipping it re-scopes Hub, All
// Files, Chains, Reminders, etc. at once. router.refresh() re-renders the server
// tree against the new view.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import { updateFileViewMode } from "@/app/actions/agent-preferences";

export function ViewModeToggle({ initialMode }: { initialMode: "all" | "mine" }) {
  const [mode, setMode] = useState<"all" | "mine">(initialMode);
  const [, start] = useTransition();
  const router = useRouter();

  function choose(next: "all" | "mine") {
    if (next === mode) return;
    setMode(next); // optimistic — the pill moves immediately
    start(async () => {
      await updateFileViewMode(next);
      router.refresh();
    });
  }

  return (
    <SegmentedSwitch
      size="sm"
      ariaLabel="Show all files or just mine"
      options={[{ id: "all", label: "All files" }, { id: "mine", label: "Just mine" }]}
      value={mode}
      onChange={(id) => choose(id as "all" | "mine")}
    />
  );
}

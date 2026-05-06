"use client";

import { useTransition } from "react";
import { updateAgentTheme } from "@/app/actions/agent-preferences";
import type { AgentTheme } from "@/lib/agent/themes";

/**
 * Hook that returns a function to switch themes.
 *
 * Updates the DOM `data-theme` attribute immediately for instant visual
 * feedback, then calls the server action to persist the choice. If the
 * server action fails, the visual change stays (we trust the user's
 * intent) but the next page load will revert to the saved theme.
 */
export function useAgentTheme() {
  const [isPending, startTransitionInternal] = useTransition();

  function setTheme(theme: AgentTheme) {
    // Update DOM immediately for instant feedback
    const wrapper = document.querySelector("[data-theme]");
    const shell = document.querySelector(".agent-shell-root");
    if (wrapper) wrapper.setAttribute("data-theme", theme);
    if (shell) shell.setAttribute("data-theme", theme);

    // Persist in background
    startTransitionInternal(() => {
      updateAgentTheme(theme).catch((err) => {
        console.error("Failed to persist theme:", err);
      });
    });
  }

  return { setTheme, isPending };
}

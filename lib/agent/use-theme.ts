"use client";

import { useTransition } from "react";
import { updateAgentTheme } from "@/app/actions/agent-preferences";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { AgentTheme } from "@/lib/agent/themes";

const THEME_NAMES: Record<AgentTheme, string> = {
  sunset:   "Sunset",
  coastal:  "Coastal",
  heritage: "Heritage",
  slate:    "Slate",
  emerald:  "Emerald",
  claret:   "Claret",
};

/**
 * Hook that returns a function to switch themes.
 *
 * Updates the DOM `data-theme` attribute immediately for instant visual
 * feedback, then calls the server action to persist the choice. If the
 * server action fails, the visual change stays (we trust the user's
 * intent) but the next page load will revert to the saved theme.
 */
export function useAgentTheme() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();

  function setTheme(theme: AgentTheme) {
    // Update DOM immediately for instant feedback
    const wrapper = document.querySelector("[data-theme]");
    const shell = document.querySelector(".agent-shell-root");
    if (wrapper) wrapper.setAttribute("data-theme", theme);
    if (shell) shell.setAttribute("data-theme", theme);

    // Persist in background
    startTransition(() => {
      updateAgentTheme(theme)
        .then((result) => {
          if (result.ok) {
            toast.success(`Theme changed to ${THEME_NAMES[theme]}`);
          } else {
            toast.error("Couldn't save theme. Try again.");
          }
        })
        .catch(() => {
          toast.error("Couldn't save theme. Try again.");
        });
    });
  }

  return { setTheme, isPending };
}

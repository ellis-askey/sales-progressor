"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { updateAgentTheme, updateAgentMobileTheme, updateAgentNightMode, updateThemeMode } from "@/app/actions/agent-preferences";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { AgentTheme, MobileAgentTheme } from "@/lib/agent/themes";
import type { ThemeMode } from "@/lib/agent/theme-mode";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

const THEME_NAMES: Record<AgentTheme, string> = {
  sunset:   "Sunset",
  coastal:  "Coastal",
  heritage: "Heritage",
  slate:    "Slate",
  emerald:  "Emerald",
  claret:   "Claret",
};

const MOBILE_THEME_NAMES: Record<MobileAgentTheme, string> = {
  heritage: "Heritage",
  sage:     "Sage",
  dusk:     "Dusk",
  stone:    "Stone",
  mist:     "Mist",
  blush:    "Blush",
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
    analytics.track(ANALYTICS_EVENTS.THEME_CHANGED, { theme });

    // Persist in background
    startTransition(() => {
      updateAgentTheme(theme)
        .then((result) => {
          if (result.ok) {
            toast.success(`Theme changed to ${THEME_NAMES[theme]}`);
            window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasThemeSet: true } }));
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

/**
 * Hook to switch the mobile theme.
 * Updates data-mobile-theme on .agent-shell-root immediately, then persists.
 */
export function useAgentMobileTheme() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();

  function setMobileTheme(mobileTheme: MobileAgentTheme) {
    const shell = document.querySelector(".agent-shell-root");
    if (shell) shell.setAttribute("data-mobile-theme", mobileTheme);

    startTransition(() => {
      updateAgentMobileTheme(mobileTheme)
        .then((result) => {
          if (result.ok) {
            toast.success(`Mobile theme changed to ${MOBILE_THEME_NAMES[mobileTheme]}`);
          } else {
            toast.error("Couldn't save mobile theme. Try again.");
          }
        })
        .catch(() => {
          toast.error("Couldn't save mobile theme. Try again.");
        });
    });
  }

  return { setMobileTheme, isPending };
}

/**
 * Hook to toggle night mode.
 * Updates data-night attribute on .agent-shell-root immediately, then persists.
 * null = auto (time-based), true = always on, false = always off.
 */
export function useAgentNightMode() {
  const [isPending, startTransition] = useTransition();

  function setNightMode(nightMode: boolean | null) {
    const shell = document.querySelector(".agent-shell-root");
    if (shell) {
      if (nightMode) {
        shell.setAttribute("data-night", "");
      } else {
        shell.removeAttribute("data-night");
      }
    }

    startTransition(() => {
      updateAgentNightMode(nightMode).catch(() => {});
    });
  }

  return { setNightMode, isPending };
}

/**
 * Unified light/dark toggle — the single source of truth for dark mode
 * (2026-08-09). Reads/writes `data-theme` on <html> (what ThemeModeBoot resolves
 * and what every dark token + the WebGL backdrop key off), and persists the
 * choice as themeMode. Both the desktop top-bar toggle and the mobile sidebar
 * pill call this, so there is one dark mode driven from two places — no more
 * separate `data-night` system.
 *
 * `initialMode` seeds the first render to avoid an icon flash before mount.
 */
export function useDarkMode(initialMode?: ThemeMode) {
  const [isDark, setIsDark] = useState<boolean>(() => initialMode === "dark");

  useEffect(() => {
    const read = () => setIsDark(document.documentElement.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const setDark = useCallback((next: boolean) => {
    const mode: ThemeMode = next ? "dark" : "light";
    if (typeof window !== "undefined") {
      // Mirror the flag ThemeModeBoot's matchMedia listener reads, and flip the
      // attribute immediately for instant feedback (server persist is async).
      (window as unknown as { __salesProgressorThemeMode__?: ThemeMode }).__salesProgressorThemeMode__ = mode;
      document.documentElement.dataset.theme = mode;
    }
    updateThemeMode(mode).catch((err) => {
      console.error("[useDarkMode] persist failed:", err);
    });
  }, []);

  return { isDark, setDark };
}

"use client";

import { useEffect } from "react";
import type { ThemeMode } from "@/lib/agent/theme-mode";

// Companion to ThemeModeBoot. The boot runs as an inline <script>, which the
// browser only executes on a HARD page load — it never re-runs on client-side
// navigation. So arriving at the agent app via a client nav (e.g. the Command
// Centre's "Back to app" link → /agent/hub) can leave <html> without the
// elevra-bg class / correct data-theme / --aurora-opacity that the boot
// establishes. The frosted-glass sidebar then samples a stale/wrong backdrop and
// reads as a dimmed nav (the "coming back from command" bug). This effect
// re-applies that exact state on every mount, so a client nav into the agent
// layout always lands with the background correctly established.
export function ThemeModeReapply({
  initialMode,
  initialAuroraOpacity = 100,
}: {
  initialMode: ThemeMode;
  initialAuroraOpacity?: number;
}) {
  useEffect(() => {
    try {
      const w = window as unknown as { __salesProgressorThemeMode__?: ThemeMode };
      const mode = w.__salesProgressorThemeMode__ ?? initialMode;
      w.__salesProgressorThemeMode__ = mode;
      const resolved =
        mode === "light" || mode === "dark"
          ? mode
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      const el = document.documentElement;
      // Only touch data-theme if it drifted from what the agent app should show,
      // so we don't fight a live in-session toggle (which updates the window flag
      // we just read from).
      if (el.dataset.theme !== resolved) el.dataset.theme = resolved;
      el.classList.add("elevra-bg");
      // Seed aurora opacity only if it was never set (a live change persists on
      // <html> across client nav, so we must not clobber it).
      if (el.style.getPropertyValue("--aurora-opacity") === "") {
        el.style.setProperty(
          "--aurora-opacity",
          String(Math.max(0, Math.min(100, initialAuroraOpacity)) / 100),
        );
      }
    } catch {
      /* CSS default kicks in */
    }
  }, [initialMode, initialAuroraOpacity]);

  return null;
}

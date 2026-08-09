"use client";

import { useState, useEffect } from "react";

/**
 * Returns the active agent theme and night-mode state so portal-rendered
 * components can apply data-theme and data-night to their own wrapper element.
 *
 * Background: the agent layout applies [data-theme] and [data-night] to
 * .agent-shell-root. React portals append to document.body — a sibling,
 * not a descendant — so they receive no CSS custom properties from the shell.
 * This hook reads both attributes from the DOM after hydration using a single
 * MutationObserver.
 *
 * Usage:
 *   const { theme, isNight } = usePortalTheme();
 *   return createPortal(
 *     <div data-theme={theme} data-night={isNight ? "" : undefined} ...>
 *       ...
 *     </div>,
 *     document.body,
 *   );
 */
export function usePortalTheme(): { theme: string; isNight: boolean } {
  const [theme, setTheme] = useState("sunset");
  const [isNight, setIsNight] = useState(false);

  useEffect(() => {
    const shell = document.querySelector(".agent-shell-root");
    const root = document.documentElement;

    function sync() {
      // theme = the AgentTheme (sunset/coastal/…) from the shell, for the
      // modal's --agent-* tokens. isNight now follows the unified app-wide dark
      // mode (data-theme="dark" on <html>), not the retired shell data-night
      // (2026-08-09). Portalled modals still stamp data-night on their own
      // wrapper so the .nv2-night[data-night] rules apply.
      const t = shell?.getAttribute("data-theme");
      if (t) setTheme(t);
      setIsNight(root.dataset.theme === "dark");
    }

    sync();

    const observer = new MutationObserver(sync);
    if (shell) {
      observer.observe(shell, { attributes: true, attributeFilter: ["data-theme"] });
    }
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return { theme, isNight };
}

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

    function sync() {
      const t = shell?.getAttribute("data-theme");
      if (t) setTheme(t);
      setIsNight(!!shell?.hasAttribute("data-night"));
    }

    sync();

    const observer = new MutationObserver(sync);
    if (shell) {
      observer.observe(shell, { attributes: true, attributeFilter: ["data-theme", "data-night"] });
    }
    return () => observer.disconnect();
  }, []);

  return { theme, isNight };
}

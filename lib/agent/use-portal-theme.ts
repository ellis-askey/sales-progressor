"use client";

import { useState, useEffect } from "react";

/**
 * Returns the active agent theme so portal-rendered components can apply
 * data-theme to their own wrapper element.
 *
 * Background: the agent layout applies [data-theme] to a display:contents div.
 * React portals append to document.body — a sibling, not a descendant — so
 * they receive no CSS custom properties from the theme wrapper. This hook
 * reads the active theme from the DOM after hydration and returns it.
 *
 * Usage:
 *   const theme = usePortalTheme();
 *   return createPortal(
 *     <div data-theme={theme} style={{ ... }}>...</div>,
 *     document.body
 *   );
 */
export function usePortalTheme(): string {
  const [theme, setTheme] = useState("sunset");

  useEffect(() => {
    const t = document.querySelector("[data-theme]")?.getAttribute("data-theme");
    if (t) setTheme(t);
  }, []);

  return theme;
}

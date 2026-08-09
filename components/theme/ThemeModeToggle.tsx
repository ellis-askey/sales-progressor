"use client";
// Desktop light/dark toggle. Binary on/off (2026-08-09) — was a three-state
// system→light→dark cycle; simplified to match the mobile pill and to make dark
// mode one thing driven from two places. Both this and the mobile sidebar pill
// use useDarkMode (data-theme on <html> + persisted themeMode).

import { Sun, Moon } from "lucide-react";
import { useDarkMode } from "@/lib/agent/use-theme";
import type { ThemeMode } from "@/lib/agent/theme-mode";

export function ThemeModeToggle({ initialMode }: { initialMode: ThemeMode }) {
  const { isDark, setDark } = useDarkMode(initialMode);
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setDark(!isDark)}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid var(--c-border, rgba(15,23,42,0.10))",
        background: "transparent",
        color: "currentColor",
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(148, 163, 184, 0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={16} />
    </button>
  );
}

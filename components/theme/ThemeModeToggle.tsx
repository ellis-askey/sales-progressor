"use client";
// Small sun/moon/display toggle for the three-state theme axis.
// Elevra-backgrounds pass, 2026-08-08.
//
// Cycles system -> light -> dark -> system on click. Optimistically updates
// the DOM (data-theme on <html>) before posting to the server, so the swap
// is instant and the server call is background. If the server rejects, the
// DOM stays flipped — the user's next reload will re-hydrate from whatever
// the DB has. Not worth reverting a UX action for a 500.
//
// Mounted in AgentShell (header) + AppShell (sidebar top row) in commit C.

import { useState, useTransition } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { updateThemeMode } from "@/app/actions/agent-preferences";
import type { ThemeMode } from "@/lib/agent/theme-mode";

const NEXT: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemeMode, string> = {
  system: "Theme: follows system",
  light: "Theme: light",
  dark: "Theme: dark",
};

function resolveNow(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeModeToggle({ initialMode }: { initialMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [, startTransition] = useTransition();

  const cycle = () => {
    const next = NEXT[mode];
    setMode(next);

    // Mirror the state that ThemeModeBoot's inline script owns, so its
    // matchMedia change listener knows the current mode and reacts (or
    // doesn't) correctly.
    if (typeof window !== "undefined") {
      (window as unknown as { __salesProgressorThemeMode__?: ThemeMode }).__salesProgressorThemeMode__ = next;
      document.documentElement.dataset.theme = resolveNow(next);
    }

    startTransition(async () => {
      try {
        await updateThemeMode(next);
      } catch (err) {
        console.error("[ThemeModeToggle] updateThemeMode failed:", err);
      }
    });
  };

  const Icon = mode === "system" ? Monitor : mode === "light" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={cycle}
      title={LABEL[mode]}
      aria-label={LABEL[mode]}
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

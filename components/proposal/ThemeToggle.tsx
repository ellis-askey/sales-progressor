"use client";

import { useEffect, useState } from "react";

// Toggles the scoped proposal theme (data-prop-theme on #prop-root) and persists
// the reader's choice. The no-flash boot script in the layout sets the initial
// value before paint; this just keeps React in sync after hydration.

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.getElementById("prop-root");
    const current = (root?.getAttribute("data-prop-theme") as "light" | "dark") ?? "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.getElementById("prop-root");
    root?.setAttribute("data-prop-theme", next);
    try {
      localStorage.setItem("prop-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="prop-iconbtn"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M13.5 9.2A5.6 5.6 0 0 1 6.8 2.5a5.6 5.6 0 1 0 6.7 6.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

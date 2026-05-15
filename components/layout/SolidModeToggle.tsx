"use client";

import { useEffect, useState } from "react";

const KEY = "agent-surface-mode";

export function SolidModeToggle() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) === "solid";
    setSolid(saved);
    if (saved) document.documentElement.setAttribute("data-solid", "");
  }, []);

  function toggle() {
    const next = !solid;
    setSolid(next);
    if (next) {
      document.documentElement.setAttribute("data-solid", "");
      localStorage.setItem(KEY, "solid");
    } else {
      document.documentElement.removeAttribute("data-solid");
      localStorage.setItem(KEY, "glass");
    }
  }

  return (
    <button
      onClick={toggle}
      title={solid ? "Switch to glass" : "Switch to solid white"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: solid ? "rgba(15,23,42,0.07)" : "none",
        border: solid ? "1px solid rgba(15,23,42,0.12)" : "1px solid transparent",
        cursor: "pointer",
        color: "var(--agent-text-muted)",
        fontSize: 11,
        fontWeight: solid ? 600 : 400,
        padding: "3px 8px",
        borderRadius: 6,
        transition: "background 150ms, border-color 150ms",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {solid ? "◧ Solid" : "◈ Glass"}
    </button>
  );
}

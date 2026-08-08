"use client";
// Design Lab toggle — small button that opens the DesignLabDrawer.
// Mounted in the AgentShell topbar; gated to Ellis in the parent so the
// button is invisible to everyone else. 2026-08-08.

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { DesignLabDrawer } from "./DesignLabDrawer";

export function DesignLabToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Design Lab (Ellis only)"
        aria-label="Open Design Lab"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--c-border, rgba(15,23,42,0.10))",
          background: "transparent",
          color: "#5b8cff",
          cursor: "pointer",
          transition: "background-color 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(91,140,255,0.10)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <FlaskConical size={15} />
      </button>
      <DesignLabDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

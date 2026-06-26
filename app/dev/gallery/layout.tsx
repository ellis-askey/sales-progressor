// Gallery layout — provides the same aurora backdrop the agent app uses,
// without the rest of the shell chrome. Necessary because the `glass-card`
// surface depends on `backdrop-filter` blurring something rich behind it.
// On a flat gallery background, glass and solid look identical (canary
// reported 2026-06-26 on the Card gallery story).
//
// Imports the same CSS the agent app loads at app/agent/layout.tsx
// (themes.css for the CSS variables; agent-system.css for the base reset
// + .agent-* classes) and mounts the aurora background at the viewport
// level so backdrop-filter has something to blur.
//
// Blocked in production at the page level (each page checks NODE_ENV).
// This layout itself doesn't gate — children handle the prod-block.

import type { ReactNode } from "react";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="sunset" className="agent-shell-root">
      {/* Aurora backdrop — pulled verbatim from AgentShell.tsx so the
          gallery renders Card against the same texture the real agent
          app uses. Without this, glass-card backdrop-filter has nothing
          to blur and looks identical to the solid variant. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background: "var(--agent-bg-base)",
          overflow: "hidden",
        }}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <filter id="agent-plasma">
              <feTurbulence type="turbulence" baseFrequency="0.009 0.006" numOctaves={4} seed={5} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#agent-plasma)" opacity={0.08} />
        </svg>
        <div style={{ position: "absolute", top: "-8%",  left: "-22%", width: "144%", height: 380, borderRadius: "50%", background: "var(--agent-aurora-band1)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "28%", left: "-22%", width: "144%", height: 340, borderRadius: "50%", background: "var(--agent-aurora-band2)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "55%", left: "-22%", width: "144%", height: 360, borderRadius: "50%", background: "var(--agent-aurora-band3)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
      </div>

      {/* Dev-only marker — visible at all times so anyone looking at the
          gallery knows what they're looking at. Production block lives
          at the page level. */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 10,
          padding: "4px 10px",
          background: "rgba(255, 107, 74, 0.12)",
          color: "var(--agent-coral, #FF6B4A)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          borderRadius: 999,
          border: "0.5px solid rgba(255, 107, 74, 0.25)",
          pointerEvents: "none",
        }}
      >
        Dev gallery
      </div>

      {children}
    </div>
  );
}

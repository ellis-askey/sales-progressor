// /dev/sheets layout — mirrors /dev/gallery/layout.tsx. Provides the
// agent shell's aurora backdrop + theme tokens so modals/drawers using
// usePortalTheme() can resolve var(--agent-coral-*) etc. correctly,
// and so glass surfaces have something to blur behind them.
//
// Blocked in production at the page level (each page checks NODE_ENV).

import type { ReactNode } from "react";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

export default function SheetsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="sunset" className="agent-shell-root">
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
            <filter id="agent-plasma-sheets">
              <feTurbulence type="turbulence" baseFrequency="0.009 0.006" numOctaves={4} seed={5} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#agent-plasma-sheets)" opacity={0.08} />
        </svg>
        <div style={{ position: "absolute", top: "-8%",  left: "-22%", width: "144%", height: 380, borderRadius: "50%", background: "var(--agent-aurora-band1)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "28%", left: "-22%", width: "144%", height: 340, borderRadius: "50%", background: "var(--agent-aurora-band2)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "55%", left: "-22%", width: "144%", height: 360, borderRadius: "50%", background: "var(--agent-aurora-band3)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
      </div>

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
        Dev sheets
      </div>

      {children}
    </div>
  );
}

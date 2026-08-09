// /dev/overlays — Ellis-only live gallery of every agent-app overlay + button.
// Provides the agent shell backdrop + theme tokens (so usePortalTheme() resolves
// var(--agent-*) and glass has something to blur), the light/dark CSS, and the
// AgentToaster provider (needed for toasts + any overlay that calls useAgentToast).
//
// Access is gated in page.tsx by email (ellis@thesalesprogressor.co.uk) — so
// unlike the other /dev pages this one is reachable on production, but only
// for that one account.

import type { ReactNode } from "react";
// Match app/agent/layout.tsx's CSS set exactly so overlays render identically,
// including their dark-mode surfaces (glass.css / kinetic-shell.css carry the
// dark tokens the portalled modals/drawers use).
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "../../agent/styles/kinetic-shell.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";
import { AgentToaster } from "@/components/agent/AgentToaster";

export default function OverlaysDevLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="sunset" className="agent-shell-root">
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: -1, background: "var(--agent-bg-base)", overflow: "hidden" }}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <filter id="agent-plasma-overlays">
              <feTurbulence type="turbulence" baseFrequency="0.009 0.006" numOctaves={4} seed={5} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#agent-plasma-overlays)" opacity={0.08} />
        </svg>
        <div style={{ position: "absolute", top: "-8%", left: "-22%", width: "144%", height: 380, borderRadius: "50%", background: "var(--agent-aurora-band1)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top: "28%", left: "-22%", width: "144%", height: 340, borderRadius: "50%", background: "var(--agent-aurora-band2)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top: "55%", left: "-22%", width: "144%", height: 360, borderRadius: "50%", background: "var(--agent-aurora-band3)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
      </div>

      <AgentToaster>{children}</AgentToaster>
    </div>
  );
}

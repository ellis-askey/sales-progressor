// Welcome-modal preview — renders the REAL WelcomeModal + ProgressorWelcomeModal
// components exactly as they present in the agent app. Loads the same CSS the
// agent app loads (themes.css for the token variables, agent-system.css for the
// .agent-* base + modal classes) and mounts an aurora backdrop, mirroring the
// /dev/gallery layout. Dev-only — the page 404s in production.

import type { ReactNode } from "react";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

export default function WelcomeModalsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="sunset" className="agent-shell-root">
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: -1, background: "var(--agent-bg-base)", overflow: "hidden" }}
      >
        <div style={{ position: "absolute", top: "-8%",  left: "-22%", width: "144%", height: 380, borderRadius: "50%", background: "var(--agent-aurora-band1)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "28%", left: "-22%", width: "144%", height: 340, borderRadius: "50%", background: "var(--agent-aurora-band2)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
        <div style={{ position: "absolute", top:  "55%", left: "-22%", width: "144%", height: 360, borderRadius: "50%", background: "var(--agent-aurora-band3)", filter: "blur(80px)", mixBlendMode: "multiply" }} />
      </div>
      {children}
    </div>
  );
}

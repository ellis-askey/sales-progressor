"use client";

// /dev-only theme shell. The real agent --agent-* vars are scoped to the app
// shell, which this standalone /dev route doesn't have — so define a compact
// light/dark palette here (scoped to .crv-devroot) and a toggle, purely so the
// drawer can be checked in both modes. None of this ships with the real drawer.

import { useState, type ReactNode } from "react";

export function DevThemeShell({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  return (
    <div className="crv-devroot" data-theme={mode} style={{ minHeight: "100vh", background: "var(--agent-bg)", transition: "background 160ms ease" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "22px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
            style={{ padding: "6px 13px", borderRadius: 999, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {mode === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
          </button>
        </div>
        {children}
      </div>
      <style>{VARS}</style>
    </div>
  );
}

const VARS = `
  .crv-devroot[data-theme="light"]{
    --agent-bg:#F3EEE6; --agent-surface-elevated:#ffffff; --agent-bg-paper:#FBF7F1;
    --agent-text-primary:#2A2320; --agent-text-secondary:#5C544C; --agent-text-muted:#8A8178;
    --agent-border-default:rgba(45,24,16,0.12); --agent-border-subtle:rgba(45,24,16,0.08); --agent-border-strong:rgba(45,24,16,0.24);
    --agent-coral-deep:#F04E2C; --agent-coral-rgb:240,78,44; --agent-success:#2E9E6B; --agent-danger:#C73E3E;
    --crv-hover:rgba(45,24,16,0.06);
  }
  .crv-devroot[data-theme="dark"]{
    --agent-bg:#0e131a; --agent-surface-elevated:#1a2029; --agent-bg-paper:#141b24;
    --agent-text-primary:#e8edf3; --agent-text-secondary:#b4bcc8; --agent-text-muted:#8a93a1;
    --agent-border-default:rgba(255,255,255,0.13); --agent-border-subtle:rgba(255,255,255,0.08); --agent-border-strong:rgba(255,255,255,0.24);
    --agent-coral-deep:#FF6B4A; --agent-coral-rgb:255,107,74; --agent-success:#4ade80; --agent-danger:#f87171;
    --crv-hover:rgba(255,255,255,0.08);
  }
`;

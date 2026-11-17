"use client";

// Disposable preview for the ported Bencho "Slide to confirm" primitive
// (components/ui/SlideToConfirm). Shows the faithful ink tone and the
// agency-primary tone, plus a 375px "mobile" column so the step-confirm use
// reads at the real width. /dev convention: throwaway, delete when decided.

import { useState } from "react";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--agent-text-muted, #8a8178)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

export default function SlideToConfirmPreview() {
  const [log, setLog] = useState<string[]>([]);
  const note = (what: string) => setLog((l) => [`${what} confirmed`, ...l].slice(0, 6));
  // Mirrors the real step-confirm: sliding opens a date box rather than
  // morphing to "Confirmed" (morphToConfirmed={false}).
  const [boxOpen, setBoxOpen] = useState(false);

  return (
    <div
      data-theme="sunset"
      style={{
        minHeight: "100vh",
        background: "var(--agent-bg, #faf7f4)",
        color: "var(--agent-text-primary, #211d18)",
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        padding: "48px 24px 120px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 44 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Slide to confirm</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary, #6b6258)", lineHeight: 1.5 }}>
            Bencho&rsquo;s primitive, ported with its tokens mapped to the agent app. Drag the handle to the end.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <Row label="Default · ink">
            <SlideToConfirm onConfirm={() => note("Default")} />
          </Row>
          <Row label="Primary · agency colour">
            <SlideToConfirm tone="primary" onConfirm={() => note("Primary")} />
          </Row>
        </div>

        <Row label="Mobile · full-width (375px)">
          <div style={{ width: 375, maxWidth: "100%", padding: 16, borderRadius: 16, background: "var(--agent-surface-elevated, #fff)", border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.06))" }}>
            <SlideToConfirm tone="primary" width={343} onConfirm={() => note("Mobile step")} />
          </div>
        </Row>

        <Row label="Step-confirm flow · slide opens the date box (no false &ldquo;Confirmed&rdquo;)">
          <div style={{ width: 375, maxWidth: "100%", padding: 16, borderRadius: 16, background: "var(--agent-surface-elevated, #fff)", border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.06))" }}>
            {!boxOpen ? (
              <SlideToConfirm tone="primary" width={343} morphToConfirmed={false} onConfirm={() => setBoxOpen(true)} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary, #6b6258)" }}>When did this happen?</span>
                <input type="date" className="account-input" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--agent-border-default, rgba(0,0,0,0.1))", fontSize: 14 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setBoxOpen(false)} style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 10, border: "1px solid var(--agent-border-default, rgba(0,0,0,0.1))", background: "#fff", fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => { setBoxOpen(false); note("Step"); }} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--agent-coral-deep, #ff6b4a)", color: "var(--agent-text-on-coral, #fff)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Confirm</button>
                </div>
              </div>
            )}
          </div>
        </Row>

        <Row label="Fired">
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary, #6b6258)", minHeight: 20, lineHeight: 1.7 }}>
            {log.length === 0 ? "Nothing yet. Slide one across." : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </Row>
      </div>
    </div>
  );
}

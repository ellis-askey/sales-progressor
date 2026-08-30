"use client";

// A subtle, persistent "Demo sale" pill on a demo showcase file, plus a small
// first-arrival popover that explains it's sample data. Replaces the old
// DemoFileBanner. Rendered at the top of the file when transaction.isDemo.
// "Seen" is tracked per-file in localStorage so the popover shows once.
// See lib/services/demo-sale.ts and docs/active/demo-sale/SPEC.md.

import { useState, useEffect } from "react";
import { Sparkle, X } from "@phosphor-icons/react";

export function DemoFileMarker({ transactionId }: { transactionId: string }) {
  const [showIntro, setShowIntro] = useState(false);
  const key = `sp_demo_intro_seen_${transactionId}`;

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) {
        const t = setTimeout(() => setShowIntro(true), 450);
        return () => clearTimeout(t);
      }
    } catch {
      /* private mode / disabled storage — just don't show it */
    }
  }, [key]);

  function dismiss() {
    try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setShowIntro(false);
  }

  return (
    <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
      {/* Persistent marker */}
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--agent-coral-deep)",
          background: "rgba(var(--agent-coral-rgb), 0.12)",
          border: "1px solid rgba(var(--agent-coral-rgb), 0.28)",
        }}
      >
        <Sparkle size={13} weight="fill" />
        Demo sale
      </span>

      {/* First-arrival popover */}
      {showIntro && (
        <div
          role="dialog"
          aria-label="Demo sale"
          className="agent-glass-strong"
          style={{
            position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 30, width: 300,
            padding: "16px 18px", borderRadius: "var(--agent-radius-lg)",
            boxShadow: "0 14px 44px rgba(15,23,42,0.18)",
            animation: "agent-modal-in 200ms cubic-bezier(0.25,0,0,1) both",
          }}
        >
          <button
            onClick={dismiss}
            aria-label="Close"
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ position: "absolute", top: 8, right: 8 }}
          >
            <X size={13} weight="bold" />
          </button>
          <p style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", paddingRight: 20 }}>
            This is your demo sale
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
            Everything here is sample data, so feel free to look around and see how a sale comes together.
          </p>
          <button
            onClick={dismiss}
            className="agent-btn agent-btn-color-primary"
            style={{ width: "100%", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 700 }}
          >
            Explore myself
          </button>
        </div>
      )}
    </div>
  );
}

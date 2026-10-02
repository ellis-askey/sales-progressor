"use client";

// Option 2: the chains "Push to exchange" tab. Every sale of yours that's ready
// on both sides but waiting on its chain, each expanding into the SAME
// ExchangeChecklist the file Overview uses — so ticking a party ready here shows
// on the file too. Critique 2026-10-02.

import { useState } from "react";
import { ExchangeChecklist } from "@/components/chain/ExchangeChecklist";
import type { ExchangePushSummary } from "@/lib/services/exchange-push";

export function ExchangePushList({ files }: { files: ExchangePushSummary[] }) {
  // First card open by default so the tab lands on something to work.
  const [open, setOpen] = useState<Set<string>>(() => new Set(files.slice(0, 1).map((f) => f.transactionId)));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        Your sales that are ready, waiting on their chains. Tick each party as you confirm them. Closest to done first.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {files.map((f) => {
          const isOpen = open.has(f.transactionId);
          const line1 = f.address.split(",")[0];
          const rest = f.address.split(",").slice(1).join(",").trim();
          return (
            <div
              key={f.transactionId}
              style={{ border: "1px solid var(--agent-border-subtle)", borderRadius: 14, background: "var(--agent-surface-elevated, #fff)", overflow: "hidden", boxShadow: "0 1px 2px rgba(42,23,16,0.04)" }}
            >
              <button
                onClick={() => toggle(f.transactionId)}
                aria-expanded={isOpen}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", background: "none", border: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#efe7dc,#e3d7c7)", color: "#b9a892", fontSize: 17 }}>🏠</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 680, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line1}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--agent-text-muted)", marginTop: 1 }}>
                    {rest ? rest + " · " : ""}your side ready · chain of {f.total}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    padding: "3px 10px",
                    borderRadius: 99,
                    fontVariantNumeric: "tabular-nums",
                    color: f.allReady ? "var(--agent-success)" : "var(--agent-coral-deep)",
                    background: f.allReady ? "rgba(var(--agent-success-rgb, 31,138,74),0.1)" : "rgba(var(--agent-coral-rgb),0.1)",
                    border: `1px solid ${f.allReady ? "rgba(var(--agent-success-rgb, 31,138,74),0.28)" : "rgba(var(--agent-coral-rgb),0.25)"}`,
                  }}
                >
                  {f.allReady ? "Ready to book" : `${f.readyCount} / ${f.total} ready`}
                </span>
                <span aria-hidden style={{ color: "var(--agent-text-muted)", fontSize: 13, transition: "transform 250ms ease", transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
              </button>
              <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 320ms cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ padding: "2px 14px 16px" }}>
                    <ExchangeChecklist push={f.push} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

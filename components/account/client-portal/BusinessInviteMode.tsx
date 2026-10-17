"use client";

// Settings → Client portal (business owner): "Client invitations". A single
// three-way choice for when buyers/sellers get their portal invite, mapped onto
// the two per-creator flags (setBusinessInviteMode). Solid-gradient selected
// state; optimistic with revert on error. Governs every file this business
// progresses; applies to new sales only (forward-only at sale creation).

import { useState, useTransition } from "react";
import { setBusinessInviteMode, type InviteMode } from "@/app/actions/progression-clients";

const OPTIONS: { key: InviteMode; label: string; sub: string }[] = [
  { key: "auto", label: "Invite automatically", sub: "Send invitations as soon as any sale is added." },
  { key: "agent_only", label: "Only when an agent adds the sale", sub: "Invite clients on agent-added sales. For sales you add, send invitations when you're ready." },
  { key: "manual", label: "I'll invite clients myself", sub: "Never send invitations automatically. You choose when each client is invited." },
];

export function BusinessInviteMode({ initial }: { initial: InviteMode }) {
  const [mode, setMode] = useState<InviteMode>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(next: InviteMode) {
    if (next === mode || pending) return;
    const prev = mode;
    setError(null);
    setMode(next);
    start(async () => {
      const res = await setBusinessInviteMode(next);
      if (!res.ok) { setMode(prev); setError(res.error); }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {OPTIONS.map((o) => {
          const on = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => pick(o.key)}
              className="text-left transition-all disabled:cursor-default"
              style={{
                display: "flex", gap: 15, alignItems: "flex-start", width: "100%",
                padding: "16px 18px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                border: on ? "1.5px solid transparent" : "1.5px solid var(--agent-border-default)",
                background: on
                  ? "linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep))"
                  : "var(--agent-surface-elevated, #fff)",
                boxShadow: on
                  ? "inset 0 1px 0 rgba(255,255,255,.3), 0 10px 24px -14px rgba(var(--agent-coral-rgb),.55)"
                  : "none",
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 2, flex: "none", width: 22, height: 22, borderRadius: 999,
                  display: "grid", placeItems: "center", transition: "all .15s",
                  border: on ? "none" : "2px solid #cbd5e1",
                  background: on ? "#fff" : "transparent",
                }}
              >
                {on && <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--agent-coral-deep)" }} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 740, letterSpacing: "-.01em", color: on ? "#fff" : "var(--agent-text-primary)" }}>{o.label}</span>
                <span style={{ display: "block", fontSize: 13, lineHeight: 1.5, marginTop: 2, color: on ? "rgba(255,255,255,.92)" : "var(--agent-text-secondary)" }}>{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p style={{ margin: "10px 2px 0", fontSize: 12.5, color: "#dc2626" }}>{error}</p>}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 9 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--agent-success, #1F8A4A)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>Your selection applies to new sales only.</span>
      </div>
    </div>
  );
}

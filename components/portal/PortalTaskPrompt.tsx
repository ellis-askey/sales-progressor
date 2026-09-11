"use client";

// PortalTaskPrompt — "here's something you can do" (Portal Engagement v2, item B).
// The gentle, one-at-a-time task nudge. This first build carries only the
// Information prompt. The overview decides whether to render it (only when no
// step is waiting to confirm, it's pre-exchange, and the client hasn't filled
// this in). Here we handle the copy, the tap, and a per-device dismiss:
// "Not now" hides it and doesn't return; it also disappears on its own once the
// client fills their information in.

import { useState } from "react";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";

export function PortalTaskPrompt({ token, side }: { token: string; side: "vendor" | "purchaser" }) {
  const dismissKey = `portal-task-information-${token}-dismissed`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  if (dismissed) return null;

  const body =
    side === "vendor"
      ? "Tell us a few things about your plans, like when you'd ideally complete, whether you're buying somewhere onward, and your moving arrangements. It helps us line everything up around you."
      : "Tell us a few things about your plans, like when you'd ideally complete, whether your funds are ready, and any notice you need to give on your current place. It helps us line everything up around you.";

  function openInfo() {
    window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "information" } }));
  }
  function dismiss() {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <PortalGlassCard glassId="task-information" label="Something you can do" className="portal-reveal-up" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: P.primaryBg, color: P.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: P.textPrimary, lineHeight: 1.25 }}>Help us keep your move on track</p>
      </div>
      <p style={{ margin: "0 0 13px", fontSize: 12.5, color: P.textSecondary, lineHeight: 1.4 }}>{body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={dismiss}
          className="pbtn pbtn-press"
          style={{ flex: "0 0 auto", padding: "9px 14px", borderRadius: 11, fontSize: 13, fontWeight: 600, border: `1px solid ${P.border}`, background: "transparent", color: P.textSecondary, cursor: "pointer" }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={openInfo}
          className="pbtn pbtn-press"
          style={{ flex: 1, padding: "9px 14px", borderRadius: 11, fontSize: 13, fontWeight: 600, border: "none", background: P.primary, color: "#fff", cursor: "pointer" }}
        >
          Add your details
        </button>
      </div>
    </PortalGlassCard>
  );
}

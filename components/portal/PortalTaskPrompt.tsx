"use client";

// PortalTaskPrompt — "here's something you can do" (Portal Engagement v2, item B).
// The gentle, one-at-a-time task nudge. This first build carries only the
// Information prompt. The overview decides whether to render it (only when no
// step is waiting to confirm, it's pre-exchange, and the client hasn't filled
// this in). Here we handle the copy, the tap, and a per-device dismiss:
// "Not now" hides it and doesn't return; it also disappears on its own once the
// client fills their information in.

import { useEffect, useState } from "react";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { portalTrackTaskPromptAction } from "@/app/actions/portal";

const PROMPT_KEY = "information";

export function PortalTaskPrompt({ token, side }: { token: string; side: "vendor" | "purchaser" }) {
  const dismissKey = `portal-task-information-${token}-dismissed`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });

  // Log "shown" once per session per device (so navigation doesn't re-count it).
  useEffect(() => {
    if (dismissed) return;
    const seenKey = `portal-task-shown-${PROMPT_KEY}-${token}`;
    try {
      if (sessionStorage.getItem(seenKey) === "1") return;
      sessionStorage.setItem(seenKey, "1");
    } catch { /* ignore */ }
    void portalTrackTaskPromptAction(token, "shown", PROMPT_KEY);
  }, [dismissed, token]);

  if (dismissed) return null;

  const body =
    side === "vendor"
      ? "Tell us a little about your plans, including when you'd ideally like to complete, whether you're buying onward and your moving arrangements. It helps us understand your circumstances as your move progresses."
      : "Tell us a little about your plans, including when you'd ideally like to complete, whether your funds are ready and any notice you need to give. It helps us understand your circumstances as your move progresses.";

  function openInfo() {
    void portalTrackTaskPromptAction(token, "clicked", PROMPT_KEY);
    window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "information" } }));
  }
  function dismiss() {
    void portalTrackTaskPromptAction(token, "dismissed", PROMPT_KEY);
    try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <PortalGlassCard glassId="task-information" label="Something you can do" className="portal-reveal-up" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: -2 }} aria-hidden>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: P.textPrimary, lineHeight: 1.25 }}>Help us keep your move on track</p>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: P.textSecondary, lineHeight: 1.4 }}>{body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={dismiss}
          className="pbtn-press portal-cta-soft"
          style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 11, fontSize: 13, fontWeight: 600 }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={openInfo}
          className="pbtn-press portal-cta"
          style={{ flex: 1, padding: "11px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}
        >
          Add your details
        </button>
      </div>
    </PortalGlassCard>
  );
}

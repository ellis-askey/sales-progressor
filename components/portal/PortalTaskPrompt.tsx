"use client";

// PortalTaskPrompt — "here's something you can do" (Portal Engagement v2, item B).
// The gentle, one-at-a-time task nudge. The overview picks the single highest-
// priority eligible prompt and passes its kind; this renders the copy, the tap,
// and a per-device dismiss ("Not now" hides that prompt and doesn't return).
// Each prompt also disappears on its own once the client does the thing.

import { useEffect, useState, type ReactNode } from "react";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { portalTrackTaskPromptAction } from "@/app/actions/portal";

export type TaskPromptKind = "information" | "stamp_duty" | "costs";

function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: -2 }} aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function CoinsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: -2 }} aria-hidden>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}

function content(kind: TaskPromptKind, side: "vendor" | "purchaser"): { heading: string; body: string; button: string; icon: ReactNode } {
  switch (kind) {
    case "stamp_duty":
      return {
        heading: "See your stamp duty",
        body: "Get a sense of the stamp duty on your purchase. A couple of quick questions and we'll make the figure accurate to your situation.",
        button: "See my stamp duty",
        icon: <CoinsIcon />,
      };
    case "costs":
      return {
        heading: "See what you'll need to complete",
        body: "Add your deposit and mortgage and we'll estimate the balance to send at completion, with your stamp duty included.",
        button: "Work out my costs",
        icon: <CoinsIcon />,
      };
    default:
      return {
        heading: "Help us keep your move on track",
        body:
          side === "vendor"
            ? "Tell us a little about your plans, including when you'd ideally like to complete, whether you're buying onward and your moving arrangements. It helps us understand your circumstances as your move progresses."
            : "Tell us a little about your plans, including when you'd ideally like to complete, whether your funds are ready and any notice you need to give. It helps us understand your circumstances as your move progresses.",
        button: "Add your details",
        icon: <ClipboardIcon />,
      };
  }
}

function runPrimary(kind: TaskPromptKind) {
  if (kind === "information") {
    window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "information" } }));
  } else if (kind === "stamp_duty") {
    window.dispatchEvent(new CustomEvent("portal:open-costs"));
  } else {
    document.getElementById("portal-costs-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function PortalTaskPrompt({ token, side, prompt }: { token: string; side: "vendor" | "purchaser"; prompt: TaskPromptKind }) {
  const dismissKey = `portal-task-${prompt}-${token}-dismissed`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });

  // Log "shown" once per session per device (so navigation doesn't re-count it).
  useEffect(() => {
    if (dismissed) return;
    const seenKey = `portal-task-shown-${prompt}-${token}`;
    try {
      if (sessionStorage.getItem(seenKey) === "1") return;
      sessionStorage.setItem(seenKey, "1");
    } catch { /* ignore */ }
    void portalTrackTaskPromptAction(token, "shown", prompt);
  }, [dismissed, token, prompt]);

  if (dismissed) return null;

  const c = content(prompt, side);

  function primary() {
    void portalTrackTaskPromptAction(token, "clicked", prompt);
    runPrimary(prompt);
  }
  function dismiss() {
    void portalTrackTaskPromptAction(token, "dismissed", prompt);
    try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <PortalGlassCard glassId={`task-${prompt}`} label="Something you can do" className="portal-reveal-up" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {c.icon}
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: P.textPrimary, lineHeight: 1.25 }}>{c.heading}</p>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: P.textSecondary, lineHeight: 1.4 }}>{c.body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={dismiss} className="pbtn-press portal-cta-soft" style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 11, fontSize: 13, fontWeight: 600 }}>
          Not now
        </button>
        <button type="button" onClick={primary} className="pbtn-press portal-cta" style={{ flex: 1, padding: "11px 16px", borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>
          {c.button}
        </button>
      </div>
    </PortalGlassCard>
  );
}

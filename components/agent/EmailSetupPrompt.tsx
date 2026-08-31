"use client";

// Director hub prompt (Phase 2 of agency email readiness). A quiet, dismissible
// nudge shown at the top of the hub for directors whose agency is still sending
// from the shared Sales Progressor address, pointing them at the sender setup
// that already exists. Reads the same hasVerifiedSender signal the onboarding
// checklist uses (a verified sending domain), so it disappears the moment the
// domain authenticates. Only mounted for directors by the hub; it self-gates on
// readiness + a per-user dismissal.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Envelope, X } from "@phosphor-icons/react";

const dismissedKey = (userId: string) => `sp_email_prompt_dismissed_${userId}`;

export function EmailSetupPrompt({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey(userId))) {
      setDismissed(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/agent/onboarding-progress");
        if (!res.ok) return;
        const data = (await res.json()) as { progress: { hasVerifiedSender?: boolean } };
        if (alive && !data.progress?.hasVerifiedSender) setShow(true);
      } catch {
        // non-critical; stay hidden on error
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  function dismiss() {
    localStorage.setItem(dismissedKey(userId), "1");
    setDismissed(true);
  }

  if (dismissed || !show) return null;

  return (
    <div
      className="agent-reveal-in"
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        background: "var(--agent-surface-elevated)",
        border: "0.5px solid var(--agent-border-default)",
        borderLeft: "3px solid var(--agent-coral)",
        borderRadius: "var(--agent-radius-lg)",
        padding: "16px 18px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "rgba(var(--agent-coral-rgb), 0.12)",
          color: "var(--agent-coral-deep)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Envelope size={18} weight="bold" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Send emails from your own address
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Right now your client emails send from Sales Progressor. Set up your agency&rsquo;s email and
          they&rsquo;ll come from you, which clients trust and open more.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/agent/account/profile"
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Set up my email
          </Link>
          <button
            type="button"
            onClick={dismiss}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--agent-text-muted)",
              background: "none",
              border: "none",
              padding: "8px 6px",
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          padding: 4,
          borderRadius: 6,
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--agent-text-muted)",
          display: "flex",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

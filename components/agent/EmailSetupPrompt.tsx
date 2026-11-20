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
import { X } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";

const dismissedKey = (userId: string) => `sp_email_prompt_dismissed_${userId}`;

export function EmailSetupPrompt({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [notNowHover, setNotNowHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);
  const [linkHover, setLinkHover] = useState(false);

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
    <GlassCard
      glassId="hub-email-nudge"
      label="Hub · Email nudge banner"
      className="agent-reveal-in agent-canon-cta"
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        borderRadius: "var(--agent-radius-lg)",
        padding: "16px 18px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Send emails from your own address
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Connect your agency email and client updates will come directly from you, keeping everything
          familiar, trusted and under your brand.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/agent/account/connections"
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Set up my email
          </Link>
          {/* Canon ghost — quiet, matches the primary's 32px height. */}
          <button
            type="button"
            onClick={dismiss}
            onMouseEnter={() => setNotNowHover(true)}
            onMouseLeave={() => setNotNowHover(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 32,
              padding: "0 12px",
              borderRadius: "var(--agent-radius-md, 10px)",
              fontSize: 14,
              fontWeight: 500,
              color: notNowHover ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
              background: notNowHover ? "var(--agent-surface-muted, rgba(45,24,16,0.05))" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 120ms ease, background 120ms ease",
            }}
          >
            Not now
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Want to change what those emails say?{" "}
          {/* Canon coral text link — coral, hover darkens to #E55B3D. */}
          <Link
            href="/agent/account/emails"
            onMouseEnter={() => setLinkHover(true)}
            onMouseLeave={() => setLinkHover(false)}
            style={{ color: linkHover ? "#E55B3D" : "#FF6B4A", fontWeight: 600, textDecoration: "none", transition: "color 120ms ease" }}
          >
            Personalise your client emails
          </Link>
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        onMouseEnter={() => setCloseHover(true)}
        onMouseLeave={() => setCloseHover(false)}
        aria-label="Dismiss"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "none",
          background: closeHover ? "var(--agent-surface-muted, rgba(45,24,16,0.07))" : "transparent",
          cursor: "pointer",
          color: closeHover ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          transition: "background 120ms ease, color 120ms ease",
        }}
      >
        <X size={14} />
      </button>
    </GlassCard>
  );
}

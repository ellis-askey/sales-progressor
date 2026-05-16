"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

const MESSAGES = [
  "Building your file…",
  "Setting up the milestones…",
  "Onboarding the neighbours…",
  "Lining up the solicitors…",
  "Getting the keys cut…",
  "Almost ready…",
];

export function SubmissionOverlay({ isVisible }: { isVisible: boolean }) {
  const { theme, isNight } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isVisible) { setMsgIndex(0); return; }
    const t = setInterval(
      () => setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1)),
      1100,
    );
    return () => clearInterval(t);
  }, [isVisible]);

  if (!mounted || !isVisible) return null;

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: "var(--nv2-surface-raised)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        animation: "agent-backdrop-in 250ms ease both",
      }}
    >
      <span
        className="agent-spinner agent-spinner-lg"
        style={{ borderColor: "rgba(var(--agent-coral-base-rgb), 0.18)", borderTopColor: "var(--agent-coral-deep)" }}
      />
      <div key={msgIndex} style={{ animation: "agent-reveal-in 300ms ease both", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nv2-text-primary)", letterSpacing: "-0.01em" }}>
          {MESSAGES[msgIndex]}
        </p>
      </div>
    </div>,
    document.body,
  );
}

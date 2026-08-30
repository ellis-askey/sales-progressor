"use client";

import { useState, useEffect } from "react";
import { Link as LinkIcon } from "@phosphor-icons/react";
import { useSolidMode } from "@/lib/hooks/useSolidMode";
import { useCardSurface } from "@/lib/glass/use-card-surface";

const STORAGE_KEY = "portal-invite-prompt-dismissed";

export function PortalInvitePrompt() {
  const isSolid = useSolidMode();
  const surface = useCardSurface("new-sale-portal-invite", "New sale · Portal invite", "");
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
    }
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setExiting(true);
    setTimeout(() => setDismissed(true), 150);
    // Telemetry: surfaced on Command Centre overview. Fire-and-forget;
    // a failure here must never block the UI.
    fetch("/api/agent/portal-invite-skip", { method: "POST" }).catch(() => {});
  }

  if (dismissed) return null;

  return (
    <div
      className={`v2-portal-invite${exiting ? " agent-reveal-out" : " agent-reveal-in"}${surface.picked ? ` ${surface.surfaceClass}` : ""}`}
      {...surface.tag}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        borderRadius: 14,
        padding: "12px 16px",
        // Default surface; a Design Lab pick takes over.
        ...(surface.picked ? {} : {
          background: isSolid ? "var(--nv2-surface-solid)" : "var(--nv2-surface-glass)",
          border: isSolid ? "1px solid var(--nv2-border-solid)" : "0.5px solid rgba(var(--agent-coral-base-rgb), 0.15)",
        }),
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "rgba(var(--agent-coral-base-rgb), 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
      }}>
        <LinkIcon size={14} color="var(--agent-coral-deep)" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "var(--nv2-text-primary)", lineHeight: 1.4 }}>
          Want to invite the buyer or seller to the client portal?
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--nv2-text-secondary)", lineHeight: 1.55 }}>
          Add their contact details below and you can send the invite once the file is created.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "var(--nv2-text-muted)", padding: 0 }}
          >
            I won&apos;t be using the client portal
          </button>
        </div>
      </div>
    </div>
  );
}

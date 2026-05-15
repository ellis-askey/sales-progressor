"use client";

import { useState, useEffect } from "react";
import { Link as LinkIcon } from "@phosphor-icons/react";

const STORAGE_KEY = "portal-invite-prompt-dismissed";

export function PortalInvitePrompt() {
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
  }

  if (dismissed) return null;

  return (
    <div className={exiting ? "agent-reveal-out" : "agent-reveal-in"} style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      background: "rgba(255,255,255,0.72)",
      border: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.15)",
      borderRadius: 14,
      padding: "12px 16px",
    }}>
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
        <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "rgba(15,23,42,0.78)", lineHeight: 1.4 }}>
          Want to invite the buyer or seller to the client portal?
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "rgba(15,23,42,0.48)", lineHeight: 1.55 }}>
          Add their contact details below and you can send portal invites once the file&apos;s created.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "rgba(15,23,42,0.38)", padding: 0 }}
          >
            Skip — I won&apos;t be using the portal
          </button>
        </div>
      </div>
    </div>
  );
}

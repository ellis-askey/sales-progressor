"use client";

// The one-line cue above the Steps list ("confirming a step emails the client").
// Dismissible per user, once: an X on the right (no circle, darkens on hover).
// Persisted in localStorage keyed by userId, mirroring EmailSetupPrompt, so once
// someone has read and closed it, it never comes back for them.

import { useEffect, useState } from "react";

const dismissedKey = (userId: string) => `sp_steps_email_hint_dismissed_${userId}`;

export function StepsEmailHint({ userId }: { userId: string }) {
  // Start hidden so a user who's already dismissed it never sees a flash — the
  // effect reveals it only when there's no stored dismissal.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(!!localStorage.getItem(dismissedKey(userId)));
  }, [userId]);

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(dismissedKey(userId), "1"); } catch { /* private mode: just hide for now */ }
    setDismissed(true);
  }

  return (
    <div
      className="mb-3 rounded-lg px-3 py-2 text-[12.5px]"
      style={{
        background: "var(--agent-surface-glass)",
        border: "0.5px solid var(--agent-border-subtle)",
        color: "var(--agent-text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <style>{`.steps-hint-x{color:var(--agent-text-muted);opacity:.6;transition:color .14s,opacity .14s}.steps-hint-x:hover{opacity:1;color:var(--agent-text-secondary)}`}</style>
      <span style={{ flex: 1, minWidth: 0 }}>
        Confirming a step sends an update to the buyer and seller. You can turn these updates off for individual files in Email settings.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this note"
        title="Dismiss"
        className="steps-hint-x"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          fontFamily: "inherit",
        }}
      >
        ✕
      </button>
    </div>
  );
}

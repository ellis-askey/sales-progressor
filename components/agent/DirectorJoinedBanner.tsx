"use client";

import { useState, useTransition } from "react";
import { dismissDirectorJoined } from "@/app/actions/dismiss-director-joined";

interface Props {
  directorName: string;
  agencyName: string;
}

export function DirectorJoinedBanner({ directorName, agencyName }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function handleDismiss() {
    startTransition(async () => {
      await dismissDirectorJoined();
      setDismissed(true);
    });
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "14px 20px",
      background: "rgba(var(--agent-success-rgb, 34,197,94),0.08)",
      border: "0.5px solid rgba(var(--agent-success-rgb, 34,197,94),0.25)",
      borderRadius: "var(--agent-radius-lg, 12px)",
      marginBottom: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        {/* Green dot */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--agent-success, #22c55e)",
          flexShrink: 0,
        }} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
          <strong>{directorName}</strong> has joined {agencyName} and can now see all your active sales.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          padding: "4px",
          color: "var(--agent-text-muted)",
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          opacity: isPending ? 0.5 : 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { dismissChainDecline } from "@/app/actions/dismiss-chain-decline";

interface Props {
  address: string;
}

export function ChainDeclineBanner({ address }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function handleDismiss() {
    startTransition(async () => {
      await dismissChainDecline();
      setDismissed(true);
    });
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "12px 20px",
      background: "rgba(239,68,68,0.06)",
      border: "0.5px solid rgba(239,68,68,0.2)",
      borderRadius: "var(--agent-radius-lg, 12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#ef4444", flexShrink: 0,
        }} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)", lineHeight: 1.5 }}>
          An agent declined your chain invite for <strong>{address}</strong>. Open their file to resend or update the contact.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Dismiss"
        style={{
          background: "none", border: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          padding: "4px", color: "var(--agent-text-muted)",
          fontSize: 18, lineHeight: 1, flexShrink: 0,
          opacity: isPending ? 0.5 : 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

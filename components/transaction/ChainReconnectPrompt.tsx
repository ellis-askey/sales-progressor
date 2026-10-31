"use client";

// Shown on a file that's just been reactivated (withdrawn -> active) when it was
// in a chain at withdrawal. The withdrawal cascade detached it from the chain and
// notified the neighbouring agents, so it can't be safely auto-reconnected — this
// surfaces a one-tap route to reconnect it, or a dismiss if the chain really is
// gone. Mirrors the warm banner styling of FileHealthBanner's attention state.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkSimpleBreak } from "@phosphor-icons/react";
import { clearChainReconnectPendingAction } from "@/app/actions/transactions";

export function ChainReconnectPrompt({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);

  if (gone) return null;

  function reconnect() {
    // Take them to the Chain tab, where the existing tools re-link the sale. The
    // flag stays set until they reconnect or dismiss, so the prompt persists if
    // they navigate away without finishing.
    router.push(`/agent/transactions/${transactionId}/chain`);
  }

  function dismiss() {
    setGone(true);
    startTransition(async () => {
      await clearChainReconnectPendingAction(transactionId).catch(() => setGone(false));
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--agent-attention-bg, #FFF4ED)",
        border: "1px solid var(--agent-attention-border, #FFD9C2)",
      }}
    >
      <span style={{ color: "#C2410C", flexShrink: 0, marginTop: 1 }}>
        <LinkSimpleBreak size={20} weight="bold" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--agent-text, #1f2430)" }}>Reconnect the chain</p>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted, #6b7280)", marginTop: 2, lineHeight: 1.45 }}>
          This sale came back after falling through. It was taken out of its chain at
          the time, and the neighbouring agents were told, so we can&apos;t put it back
          automatically. Reconnect it so the chain is up to date again.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            type="button"
            onClick={reconnect}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            Reconnect the chain
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="agent-btn agent-btn-sm agent-btn-ghost"
          >
            No chain needed
          </button>
        </div>
      </div>
    </div>
  );
}

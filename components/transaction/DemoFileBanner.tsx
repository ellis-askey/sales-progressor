"use client";

// Demo badge + "Remove now" on a demo showcase file, so it's never mistaken
// for a real sale and can be removed on demand. Rendered at the top of the
// file when transaction.isDemo. See lib/services/demo-sale.ts and
// docs/active/demo-sale/SPEC.md.

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { removeDemoSaleAction } from "@/app/actions/demo";

export function DemoFileBanner({
  transactionId,
  expiresAtIso,
}: {
  transactionId: string;
  expiresAtIso: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const expires = expiresAtIso
    ? new Date(expiresAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
    : null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        marginBottom: 16,
        borderRadius: 12,
        border: "1px solid var(--agent-coral-deep, #FF6B4A)",
        background: "var(--agent-coral-bg-tint, rgba(255,107,74,0.10))",
      }}
    >
      <Sparkle size={20} weight="fill" color="var(--agent-coral-deep, #FF6B4A)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Demo file
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>
          {expires
            ? `A worked example to explore. It removes itself on ${expires}, or remove it whenever you like.`
            : "A worked example to explore. Remove it whenever you like."}
        </p>
        {error && (
          <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{error}</p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await removeDemoSaleAction(transactionId);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "";
              if (msg && !msg.includes("NEXT_REDIRECT")) setError("Could not remove it. Try again.");
            }
          })
        }
      >
        {pending ? "Removing" : "Remove now"}
      </Button>
    </div>
  );
}

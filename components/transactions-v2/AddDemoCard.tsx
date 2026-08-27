"use client";

// "Add a demo" affordance on the new-sale page. Shown to an agency with no real
// sales yet (and no existing demo). Stands up a fully-worked example file so a
// new agency can see a sale in full before committing their own. The demo
// removes itself after a week, or they can remove it whenever. See
// lib/services/demo-sale.ts and docs/active/demo-sale/SPEC.md.

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { addDemoSaleAction } from "@/app/actions/demo";

export function AddDemoCard() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="agent-glass"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 18px",
        marginBottom: 18,
        borderRadius: "var(--agent-radius-lg, 14px)",
        border: "1px solid var(--agent-border-subtle, rgba(15,23,42,0.08))",
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--agent-coral-bg-tint, rgba(255,107,74,0.12))",
          color: "var(--agent-coral-deep, #FF6B4A)",
        }}
      >
        <Sparkle size={20} weight="fill" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          New here? See a sale in full first
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)" }}>
          Add a worked example file to explore how a sale runs. It removes itself after a week, or you can remove it whenever you like.
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
              await addDemoSaleAction();
            } catch (e) {
              // A thrown redirect is handled by the framework; only surface real errors.
              const msg = e instanceof Error ? e.message : "";
              if (msg && !msg.includes("NEXT_REDIRECT")) setError("Could not add the demo. Try again.");
            }
          })
        }
      >
        {pending ? "Adding" : "Add a demo file"}
      </Button>
    </div>
  );
}

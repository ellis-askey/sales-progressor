"use client";

// /dev/chain-reconnect — preview of the "reconnect the chain" prompt that appears
// on a file reactivated from withdrawn when it was in a chain at the time (#10).
// The real component is rendered; its Reconnect button navigates to a (dev) chain
// route and Dismiss hits the real action — harmless against a made-up id here, so
// treat the buttons as visual only. Blocks in prod.

import { notFound } from "next/navigation";
import { ChainReconnectPrompt } from "@/components/transaction/ChainReconnectPrompt";

export default function DevChainReconnectPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
      <p style={{ fontSize: 13, color: "var(--agent-text-muted, #6b7280)", marginBottom: 16 }}>
        Preview: the prompt shown on a file after it&apos;s brought back from withdrawn,
        when it was in a chain at the time.
      </p>
      <ChainReconnectPrompt transactionId="dev-preview" />
    </div>
  );
}

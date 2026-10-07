"use client";

// components/progression/BusinessCardCapture.tsx
//
// Card capture on the business Billing tab (C1). Reuses the canonical
// CardCaptureForm, pointed at the business setup-intent route. On a saved card
// it creates/reconciles the Stripe subscription (so billing can start) and
// refreshes. Only rendered when the collection switch is on.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";
import { syncBusinessSubscriptionAction } from "@/app/actions/progression-clients";

export function BusinessCardCapture({ publishableKey }: { publishableKey: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSuccess() {
    // Card is on file — create/reconcile the subscription so monthly billing
    // can run. If that fails, surface it rather than show a false "Card saved".
    setError(null);
    const r = await syncBusinessSubscriptionAction().catch(() => null);
    if (r && !r.ok) { setError(r.error); return; }
    setSaved(true);
    router.refresh();
  }

  if (saved) {
    return (
      <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>
        Card saved. We&rsquo;ll charge it each month for your subscription and the sales you add.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
          Your card was saved, but we couldn&rsquo;t start the subscription: {error}
        </div>
      )}
      <CardCaptureForm
        publishableKey={publishableKey}
        setupIntentUrl="/api/billing/business/setup-intent"
        returnUrl="/agent/settings/billing?saved=1"
        onSuccess={onSuccess}
      />
    </>
  );
}

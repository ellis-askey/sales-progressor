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

  async function onSuccess() {
    // Card is on file — create/reconcile the subscription so monthly billing
    // can run. The action no-ops safely if the Stripe prices aren't set yet.
    await syncBusinessSubscriptionAction().catch(() => {});
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
    <CardCaptureForm
      publishableKey={publishableKey}
      setupIntentUrl="/api/billing/business/setup-intent"
      returnUrl="/agent/settings/billing?saved=1"
      onSuccess={onSuccess}
    />
  );
}

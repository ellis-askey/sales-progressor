"use client";

// components/progression/BusinessCardCapture.tsx
//
// Card capture on the business Billing tab (C1). Reuses the canonical
// CardCaptureForm, pointed at the business setup-intent route. On a saved card
// it creates/reconciles the Stripe subscription (so billing can start) and
// refreshes. Only rendered when the collection switch is on.
//
// Two save paths converge on startSubscription():
//   - No 3-D Secure: confirmSetup returns inline, onSuccess fires, we sync here.
//   - 3-D Secure (most UK cards): Stripe redirects to the bank and back to the
//     billing page (?saved=1&redirect_status=succeeded), so onSuccess never runs.
//     The page passes justReturned=true and we start the subscription on mount.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";
import { syncBusinessSubscriptionAction } from "@/app/actions/progression-clients";

export function BusinessCardCapture({
  publishableKey,
  justReturned = false,
}: {
  publishableKey: string;
  justReturned?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Start (or reconcile) the subscription once the card is on file.
  async function startSubscription() {
    setError(null);
    setFinishing(true);
    const r = await syncBusinessSubscriptionAction().catch(() => null);
    setFinishing(false);
    // A thrown call yields null — treat it as a failure, never a false "card saved".
    if (!r || !r.ok) {
      setError(r?.error ?? "Your card was saved, but we couldn't start your subscription. Refresh and try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // 3-D Secure return: the card is already saved with Stripe, so start the
  // subscription now instead of re-showing the empty card form.
  useEffect(() => {
    if (justReturned) startSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReturned]);

  if (saved) {
    return (
      <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: 13 }}>
        Card saved. We&rsquo;ll charge it on the 1st of each month for your subscription and the sales you add.
      </div>
    );
  }

  if (finishing) {
    return (
      <div style={{ padding: 16, color: "var(--agent-text-secondary, #6b7280)", fontSize: 13 }}>
        Finishing setup&hellip;
      </div>
    );
  }

  // Returned from the bank but the subscription didn't start — show the error with a
  // retry (the card itself is already saved, so don't re-mount the Stripe form).
  if (justReturned) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}
        <button type="button" className="agent-btn agent-btn-primary agent-btn-md" onClick={startSubscription}>
          Finish setting up billing
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}
      <CardCaptureForm
        publishableKey={publishableKey}
        setupIntentUrl="/api/billing/business/setup-intent"
        returnUrl="/agent/settings/billing?saved=1"
        onSuccess={startSubscription}
      />
    </>
  );
}

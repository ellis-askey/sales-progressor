"use client";

// components/billing/CardCaptureForm.tsx
//
// Stripe Elements card-capture form. On mount, fetches a SetupIntent
// client_secret from /api/billing/setup-intent (the endpoint creates or
// reuses the agency's Stripe Customer). The Elements provider then renders
// the PaymentElement; submit confirms the SetupIntent — Stripe attaches
// the PaymentMethod to the Customer for future charging (PR 7).
//
// No charge happens here. PR 6 is card-on-file only.

import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type Props = {
  publishableKey: string;
};

export function CardCaptureForm({ publishableKey }: Props) {
  const [stripePromise] = useState<Promise<StripeJs | null>>(() => loadStripe(publishableKey));
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/setup-intent", { method: "POST" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setError(data.error ?? "Couldn't start card setup");
          return;
        }
        const data = (await res.json()) as { clientSecret: string };
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch {
        if (!cancelled) setError("Couldn't reach the server — check your connection and try again");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          fontSize: 13,
          color: "#dc2626",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        {error}
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div style={{ padding: 16, color: "var(--agent-text-secondary, #6b7280)" }}>
        Preparing card form…
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerForm />
    </Elements>
  );
}

function InnerForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // Stripe takes over from here — confirmSetup redirects on success,
    // or surfaces an error in the result.
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: typeof window !== "undefined" ? `${window.location.origin}/agent/billing?saved=1#payment-method` : "/agent/billing?saved=1#payment-method",
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? "Card couldn't be saved — try again");
      setSubmitting(false);
      return;
    }
    setSaved(true);
    setSubmitting(false);
  }

  if (saved) {
    return (
      <div
        style={{
          padding: 16,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          color: "#166534",
        }}
      >
        Card saved. We'll charge it on the 1st of each month for that month's exchanges.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <PaymentElement />
      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        style={{
          padding: "12px 20px",
          background: submitting ? "#94a3b8" : "var(--agent-primary, #FF6B4A)",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          alignSelf: "start",
        }}
      >
        {submitting ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

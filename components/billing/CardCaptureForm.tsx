"use client";

// components/billing/CardCaptureForm.tsx
//
// Stripe Elements card-capture form. On mount, fetches a SetupIntent
// client_secret from /api/billing/setup-intent (the endpoint creates or
// reuses the agency's Stripe Customer). The Elements provider then renders
// the PaymentElement; submit confirms the SetupIntent and Stripe attaches
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
  // When provided: skip the in-form green "Card saved" banner and fire
  // this callback instead. The parent (e.g. TrialExpiredModal) advances
  // to its own success step. When omitted: existing standalone behaviour
  // (settings page renders the green banner inline).
  onSuccess?: () => void;
};

export function CardCaptureForm({ publishableKey, onSuccess }: Props) {
  // Defensive: an empty or non "pk_..." key means loadStripe will return
  // null and PaymentElement will mount into the DOM but render no inputs.
  // Surface the misconfiguration up-front instead of leaving the form
  // visibly blank above the Save card button.
  const isKeyValid = publishableKey.startsWith("pk_");
  const [stripePromise] = useState<Promise<StripeJs | null> | null>(() =>
    isKeyValid ? loadStripe(publishableKey) : null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isKeyValid) return;
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
        if (!cancelled) setError("Couldn't reach the server. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isKeyValid]);

  if (!isKeyValid) {
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
        Card capture isn&apos;t configured for this environment. Tell support and try again later.
      </div>
    );
  }

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
      <InnerForm onSuccess={onSuccess} />
    </Elements>
  );
}

function InnerForm({ onSuccess }: { onSuccess?: () => void }) {
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
    // Stripe takes over from here: confirmSetup redirects on success,
    // or surfaces an error in the result.
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: typeof window !== "undefined" ? `${window.location.origin}/agent/account/billing?saved=1#payment-method` : "/agent/account/billing?saved=1#payment-method",
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? "Card couldn't be saved. Try again.");
      setSubmitting(false);
      return;
    }
    setSaved(true);
    setSubmitting(false);
    // When a parent supplies onSuccess, defer the success UI to them
    // (e.g. modal advances to its own "You're all set" step). When
    // absent, fall through to the in-form green banner below.
    if (onSuccess) onSuccess();
  }

  if (saved && !onSuccess) {
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
        Card saved. We&apos;ll charge it on the 1st of each month for that month&apos;s exchanges.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      {/* Reserve room for the Stripe iframe so a slow or failed mount
          doesn't collapse to a 0px gap above the Save card button.
          Placeholder text sits behind the iframe and is hidden once
          Stripe injects content. */}
      <div style={{ position: "relative", minHeight: 180 }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--agent-text-secondary, #6b7280)",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          Loading card details…
        </div>
        <PaymentElement
          onLoadError={() =>
            setError("Couldn't load Stripe's card form. Refresh and try again.")
          }
        />
      </div>
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
        className="agent-btn agent-btn-primary agent-btn-lg"
        style={{ width: "100%" }}
      >
        {submitting ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

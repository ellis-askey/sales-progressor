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
  // Setup-intent endpoint + post-save return URL. Default to the agency
  // billing path; a progression business passes its own (business setup-intent
  // route + business billing page).
  setupIntentUrl?: string;
  returnUrl?: string;
};

export function CardCaptureForm({ publishableKey, onSuccess, setupIntentUrl = "/api/billing/setup-intent", returnUrl }: Props) {
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
  // Bumping this re-runs the SetupIntent fetch — the "Try again" button on a
  // failed/blipped load, so the user isn't stuck on a dead error with no form.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isKeyValid) return;
    let cancelled = false;
    setError(null);
    setClientSecret(null);
    (async () => {
      try {
        const res = await fetch(setupIntentUrl, { method: "POST" });
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
  }, [isKeyValid, setupIntentUrl, reloadKey]);

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
        className="ccf-fade"
        style={{
          display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start",
          fontSize: 13,
          color: "#dc2626",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        <span>{error}</span>
        <button
          type="button"
          onClick={() => { setError(null); setReloadKey((k) => k + 1); }}
          className="agent-btn agent-btn-neutral agent-btn-sm"
        >
          Try again
        </button>
        <CardFormStyles />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="ccf-fade" style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, color: "var(--agent-text-secondary, #6b7280)", fontSize: 13 }}>
        <span className="ccf-spin" aria-hidden />
        Preparing card form…
        <CardFormStyles />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
      <InnerForm onSuccess={onSuccess} returnUrl={returnUrl} />
    </Elements>
  );
}

// Shared spinner + fade keyframes for every loading/transition state in this form.
// Reduced-motion drops the fade and freezes the spinner.
function CardFormStyles() {
  return (
    <style>{`
      .ccf-spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(128,128,128,.28); border-top-color: var(--agent-coral-deep, #FF6B4A); animation: ccf-spin .7s linear infinite; flex-shrink: 0; }
      @keyframes ccf-spin { to { transform: rotate(360deg); } }
      .ccf-fade { animation: ccf-fade 180ms ease both; }
      @keyframes ccf-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .ccf-spin { animation: none; } .ccf-fade { animation: none; } }
    `}</style>
  );
}

// Theme Stripe's hosted inputs to match our own fields — coral accent, our radius
// and type, soft warm borders with a coral focus ring. Tuned for the light theme
// (the dominant surface); a dark-aware variant is a follow-up.
const STRIPE_APPEARANCE = {
  variables: {
    colorPrimary: "#FF6B4A",
    colorText: "#2D1810",
    colorTextSecondary: "#5A3A28",
    colorTextPlaceholder: "rgba(45,24,16,0.4)",
    colorDanger: "#C73E3E",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSizeBase: "14px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(45,24,16,0.14)", boxShadow: "none", padding: "11px 12px" },
    ".Input:focus": { border: "1px solid #FF6B4A", boxShadow: "0 0 0 3px rgba(255,138,101,0.18)" },
    ".Label": { fontWeight: "600", color: "#5A3A28" },
  },
} as const;

function InnerForm({ onSuccess, returnUrl }: { onSuccess?: () => void; returnUrl?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The Stripe PaymentElement reports when it has actually mounted its inputs.
  // Until then the "Save card" button stays disabled — so it can never be a live
  // button sitting above an empty (still-loading or failed) form.
  const [elementReady, setElementReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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
        return_url: returnUrl
          ? (typeof window !== "undefined" ? `${window.location.origin}${returnUrl}` : returnUrl)
          : (typeof window !== "undefined" ? `${window.location.origin}/agent/account/billing?saved=1#payment-method` : "/agent/account/billing?saved=1#payment-method"),
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
        className="ccf-fade"
        style={{
          padding: 16,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          color: "#166534",
        }}
      >
        Card saved. We&apos;ll charge it on the 1st of each month for that month&apos;s exchanges.
        <CardFormStyles />
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
        {!elementReady && !loadFailed && (
          <div
            aria-hidden
            className="ccf-fade"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "var(--agent-text-secondary, #6b7280)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            <span className="ccf-spin" aria-hidden />
            Loading card details…
          </div>
        )}
        <PaymentElement
          onReady={() => setElementReady(true)}
          onLoadError={() => {
            setLoadFailed(true);
            setError("Couldn't load the card form. Try again.");
          }}
        />
      </div>
      {error && (
        <div
          className="ccf-fade"
          style={{
            display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start",
            fontSize: 13,
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <span>{error}</span>
          {loadFailed && (
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
              className="agent-btn agent-btn-neutral agent-btn-sm"
            >
              Try again
            </button>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !stripe || !elements || !elementReady || loadFailed}
        className="agent-btn agent-btn-primary agent-btn-lg"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <span className="ccf-spin" aria-hidden style={{ borderTopColor: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.35)" }} />}
        {submitting ? "Saving…" : "Save card"}
      </button>
      <CardFormStyles />
    </form>
  );
}

"use client";

// components/progression/BusinessCardCapture.tsx
//
// Card capture + plan start for an external progression business. Reuses the
// canonical CardCaptureForm (Stripe) and then creates/reconciles the subscription
// so billing can begin. A small state machine so every path has a recovery:
//
//   form → (inline save | 3-D Secure redirect+return) → finishing → saved
//                                                           └→ error → RETRY
//
//   - No 3-D Secure: confirmSetup returns inline → onSuccess → startSubscription.
//   - 3-D Secure (most UK cards): Stripe redirects to the bank and back to the
//     return URL (?saved=1&redirect_status=succeeded) → justReturned=true starts the
//     subscription on mount. A failed return (redirect_status=failed) → authFailed.
//   - Subscription start FAILS (either path): the card is already attached, so we
//     show a "Finish setting up billing" retry (never re-mount the dead Stripe form).
//   - onComplete (modal use): instead of the inline "saved" banner, hand back to the
//     parent so it can close + refresh. addSaleHref (page use): offer a way onward.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";
import { syncBusinessSubscriptionAction } from "@/app/actions/progression-clients";

export function BusinessCardCapture({
  publishableKey,
  justReturned = false,
  authFailed = false,
  onComplete,
  addSaleHref,
}: {
  publishableKey: string;
  justReturned?: boolean;
  // Returned from a 3-D Secure attempt that FAILED (redirect_status=failed).
  authFailed?: boolean;
  // Modal use: called once the subscription has started, so the parent can close
  // and refresh instead of showing the inline "Card saved" banner.
  onComplete?: () => void;
  // Page use: where to go next after a successful save (e.g. add a sale).
  addSaleHref?: string;
}) {
  const router = useRouter();
  // The card is attached at Stripe (inline confirmSetup succeeded, or we're back
  // from a successful 3-D Secure) — so a failure past this point is a subscription
  // problem to retry, not a re-enter-the-card problem.
  const [cardCaptured, setCardCaptured] = useState(justReturned);
  const [saved, setSaved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(
    authFailed ? "Your bank couldn't verify that card. Please try again." : null,
  );

  async function startSubscription() {
    setError(null);
    setFinishing(true);
    const r = await syncBusinessSubscriptionAction().catch(() => null);
    setFinishing(false);
    if (!r || !r.ok) {
      setError(r?.error ?? "Your card was saved, but we couldn't start your plan. Try again.");
      return;
    }
    if (onComplete) { onComplete(); return; }
    setSaved(true);
    router.refresh();
  }

  // 3-D Secure return: the card is already saved, so start the subscription now.
  useEffect(() => {
    if (justReturned) startSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReturned]);

  if (saved) {
    return (
      <div className="bcc-fade" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, color: "#166534", fontSize: 13 }}>
          Card saved. We&rsquo;ll charge it on the 1st of each month for your subscription and the sales you add.
        </div>
        {addSaleHref && (
          <a href={addSaleHref} className="agent-btn agent-btn-primary agent-btn-md" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
            Add a sale →
          </a>
        )}
        <BccStyles />
      </div>
    );
  }

  if (finishing) {
    return (
      <div className="bcc-fade" style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, color: "var(--agent-text-secondary, #6b7280)", fontSize: 13 }}>
        <span className="acg-spin" aria-hidden />
        Finishing setup&hellip;
        <BccStyles />
      </div>
    );
  }

  // Card attached but the subscription didn't start (either path) — retry the
  // subscription, don't re-show the (already-consumed) Stripe form.
  if (cardCaptured && error) {
    return (
      <div className="bcc-fade" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
        <button type="button" className="agent-btn agent-btn-primary agent-btn-md" onClick={startSubscription} style={{ alignSelf: "flex-start" }}>
          Finish setting up billing
        </button>
        <BccStyles />
      </div>
    );
  }

  return (
    <div className="bcc-fade">
      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}
      <CardCaptureForm
        publishableKey={publishableKey}
        setupIntentUrl="/api/billing/business/setup-intent"
        returnUrl="/agent/settings/billing?saved=1"
        onSuccess={() => { setCardCaptured(true); startSubscription(); }}
      />
      <BccStyles />
    </div>
  );
}

// Spinner + a short cross-fade so swapping between form / finishing / error / saved
// is a soft transition, not a hard cut. Reduced motion drops both.
function BccStyles() {
  return (
    <style>{`
      .acg-spin{width:15px;height:15px;border-radius:50%;border:2px solid rgba(128,128,128,.3);border-top-color:var(--agent-coral-deep,#FF6B4A);animation:acg-spin .7s linear infinite;flex-shrink:0}
      @keyframes acg-spin{to{transform:rotate(360deg)}}
      .bcc-fade{animation:bcc-fade 180ms ease both}
      @keyframes bcc-fade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion: reduce){.acg-spin{animation:none}.bcc-fade{animation:none}}
    `}</style>
  );
}

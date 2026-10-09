"use client";

// Billing-tab payment method. Once a card is on file we show it ("Visa ending
// 4242") instead of an empty Stripe form, so an active business isn't asked to
// re-enter a card they've already saved. "Update card" reveals the form to
// replace it — which reuses the existing subscription (no new charge). With no
// card yet (or returning from a 3-D Secure save/failure) it shows the capture form.

import { useState } from "react";
import { BusinessCardCapture } from "./BusinessCardCapture";

type Card = { brand: string; last4: string; expMonth: number; expYear: number };

export function BusinessPaymentMethod({
  card,
  active = false,
  failed = false,
  publishableKey,
  justReturned = false,
  authFailed = false,
  addSaleHref,
}: {
  card: Card | null;
  // Billing is active (a card/subscription is on file) even if the card DETAILS
  // couldn't be read from Stripe this render — so we never drop back to an empty
  // form for an active business on a transient read error.
  active?: boolean;
  // The card on file is failing (dunning warning/blocked) — flag it on the row.
  failed?: boolean;
  publishableKey: string;
  justReturned?: boolean;
  authFailed?: boolean;
  addSaleHref?: string;
}) {
  const [editing, setEditing] = useState(false);

  // Returning from a 3-D Secure save: let the capture component finish starting
  // the subscription on mount.
  if (justReturned) return <BusinessCardCapture publishableKey={publishableKey} justReturned addSaleHref={addSaleHref} />;

  const hasCardOnFile = !!card || active;

  // No card yet, a failed 3-DS attempt, or replacing a card: show the Stripe form.
  if (!hasCardOnFile || authFailed || editing) {
    return (
      <div className="bpm-fade" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <BusinessCardCapture publishableKey={publishableKey} authFailed={authFailed} addSaleHref={addSaleHref} />
        {hasCardOnFile && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-muted)" }}
          >
            Cancel
          </button>
        )}
        <BpmStyles />
      </div>
    );
  }

  // Card on file. Show the real brand/last4 when Stripe returned them, else a
  // details-free "Card on file" — never the empty form.
  const label = card
    ? `${card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card"} ending ${card.last4}`
    : "Card on file";
  const sub = failed
    ? "Payment failed. Update your card to continue"
    : card
      ? `Expires ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)} · we'll charge this each month`
      : "We'll charge this card each month";
  return (
    <div className="bpm-fade" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12, color: failed ? "var(--agent-danger, #C73E3E)" : "var(--agent-text-muted)", fontWeight: failed ? 600 : 400 }}>{sub}</div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`agent-btn ${failed ? "agent-btn-primary" : "agent-btn-neutral"} agent-btn-sm`}
        style={{ marginLeft: "auto" }}
      >
        Update card
      </button>
      <BpmStyles />
    </div>
  );
}

// Soft cross-fade when swapping between the card-on-file row and the edit form.
function BpmStyles() {
  return (
    <style>{`
      .bpm-fade{animation:bpm-fade 180ms ease both}
      @keyframes bpm-fade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion: reduce){.bpm-fade{animation:none}}
    `}</style>
  );
}

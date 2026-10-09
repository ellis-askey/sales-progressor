"use client";

// Billing-tab payment method. Once a card is on file we show it ("Visa ending
// 4242") instead of an empty Stripe form, so an active business isn't asked to
// re-enter a card they've already saved. "Update card" reveals the form to
// replace it — which reuses the existing subscription (no new charge). With no
// card yet (or returning from a 3-D Secure save/failure) it shows the capture form.

import { useState } from "react";
import { CreditCard } from "@phosphor-icons/react";
import { BusinessCardCapture } from "./BusinessCardCapture";

type Card = { brand: string; last4: string; expMonth: number; expYear: number };

export function BusinessPaymentMethod({
  card,
  active = false,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
      </div>
    );
  }

  // Card on file. Show the real brand/last4 when Stripe returned them, else a
  // details-free "Card on file" — never the empty form.
  const label = card
    ? `${card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card"} ending ${card.last4}`
    : "Card on file";
  const sub = card
    ? `Expires ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)} · we'll charge this each month`
    : "We'll charge this card each month";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span aria-hidden style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb),0.1)" }}>
        <CreditCard size={20} weight="regular" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{sub}</div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="agent-btn agent-btn-neutral agent-btn-sm"
        style={{ marginLeft: "auto" }}
      >
        Update card
      </button>
    </div>
  );
}

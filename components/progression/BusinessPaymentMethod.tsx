"use client";

// Billing-tab payment method. Once a card is on file we show it ("Visa ending
// 4242") instead of an empty Stripe form, so an active business isn't asked to
// re-enter a card they've already saved. "Update card" reveals the form to
// replace it — which reuses the existing subscription (no new charge). With no
// card yet (or returning from a 3-D Secure save) it shows the capture form.

import { useState } from "react";
import { CreditCard } from "@phosphor-icons/react";
import { BusinessCardCapture } from "./BusinessCardCapture";

type Card = { brand: string; last4: string; expMonth: number; expYear: number };

export function BusinessPaymentMethod({
  card,
  publishableKey,
  justReturned = false,
}: {
  card: Card | null;
  publishableKey: string;
  justReturned?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  // Returning from a 3-D Secure save: let the capture component finish starting
  // the subscription on mount.
  if (justReturned) return <BusinessCardCapture publishableKey={publishableKey} justReturned />;

  // No card yet, or replacing one: show the Stripe form.
  if (!card || editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <BusinessCardCapture publishableKey={publishableKey} />
        {card && (
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

  // Card on file.
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card";
  const exp = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span aria-hidden style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb),0.1)" }}>
        <CreditCard size={20} weight="regular" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>{brand} ending {card.last4}</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Expires {exp} · we&rsquo;ll charge this each month</div>
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

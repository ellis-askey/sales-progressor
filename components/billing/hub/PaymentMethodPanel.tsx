"use client";

// components/billing/polish/PaymentMethodPanel.tsx
//
// Polish redesign of the payment-method surface. Folds the old standalone
// /agent/billing/payment-method screen into a section that lives directly
// on the hub. Three states:
//   - "card_on_file" — show card brand + last4 + trust surround + Update button
//   - "add_card"     — show real Stripe Elements form via existing CardCaptureForm
//   - "pending"      — disclosure not yet acknowledged; render RedesignedDisclosure
//
// Adds the trust surround (lock icon + "Securely stored by Stripe" line)
// and the "what happens next" microcopy. Replaces the bare current screen.

import { useState } from "react";
import { CreditCard, Lock, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";

type CardOnFile = {
  brand: string;            // "visa" / "mastercard" / ...
  last4: string;            // "4242"
  expMonth: number;         // 12
  expYear: number;          // 2030
};

export type PaymentMethodPanelProps =
  | { kind: "card_on_file"; card: CardOnFile; publishableKey: string }
  | { kind: "add_card"; publishableKey: string }
  | { kind: "pending" }; // disclosure-not-acknowledged — rendered by parent

function brandLabel(b: string): string {
  switch (b.toLowerCase()) {
    case "visa": return "Visa";
    case "mastercard": return "Mastercard";
    case "amex":
    case "american_express": return "American Express";
    case "discover": return "Discover";
    default: return b.charAt(0).toUpperCase() + b.slice(1);
  }
}

export function PaymentMethodPanel(props: PaymentMethodPanelProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  return (
    <div
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Payment method
        </h2>
        {props.kind === "card_on_file" && !showUpdateForm && (
          <button
            type="button"
            className="agent-btn agent-btn-ghost agent-btn-sm"
            onClick={() => setShowUpdateForm(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowsClockwise size={12} weight="bold" />
            Update
          </button>
        )}
      </div>

      {/* Body per state */}
      {props.kind === "pending" && (
        <div style={{ fontSize: 13, color: "var(--agent-text-muted)", padding: "6px 0" }}>
          Acknowledge the pricing terms below to add a card.
        </div>
      )}

      {props.kind === "card_on_file" && !showUpdateForm && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--agent-readonly-bg, rgba(0,0,0,0.025))",
              border: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
            }}
          >
            <CreditCard size={28} weight="duotone" color="var(--agent-text-secondary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {brandLabel(props.card.brand)} ····{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{props.card.last4}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 2 }}>
                Expires {String(props.card.expMonth).padStart(2, "0")}/{String(props.card.expYear).slice(-2)}
              </div>
            </div>
          </div>
        </>
      )}

      {(props.kind === "add_card" || (props.kind === "card_on_file" && showUpdateForm)) && (
        <CardCaptureForm publishableKey={(props as { publishableKey: string }).publishableKey} />
      )}

      {/* Trust surround — always shown except in pending state */}
      {props.kind !== "pending" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--agent-text-muted)",
            paddingTop: 4,
          }}
        >
          <Lock size={13} weight="regular" />
          Securely stored by Stripe — we never see your card number.
        </div>
      )}

      {/* What happens next */}
      {props.kind !== "pending" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--agent-text-muted)",
            background: "var(--agent-readonly-bg, rgba(0,0,0,0.025))",
            padding: "8px 12px",
            borderRadius: 8,
            lineHeight: 1.5,
          }}
        >
          We'll charge this card on the 1st of each month for that month's exchanges.
        </div>
      )}
    </div>
  );
}

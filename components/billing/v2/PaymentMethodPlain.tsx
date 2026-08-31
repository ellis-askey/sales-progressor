"use client";

// components/billing/v2/PaymentMethodPlain.tsx
//
// Same three states as v1 PaymentMethodPanel — card_on_file, add_card,
// pending — but unwrapped from the agent-glass card so it sits directly
// on the near-document canvas. Trust line + "what happens next" microcopy
// preserved (these are right). The Stripe Elements form (CardCaptureForm)
// is reused as-is.

import { useState } from "react";
import { CreditCard, Lock, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";

type CardOnFile = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type PaymentMethodPlainProps =
  // card === null when a card is on file but its details can't be read (e.g.
  // Stripe not configured in this environment) — shown as "Card on file".
  | { kind: "card_on_file"; card: CardOnFile | null; publishableKey: string }
  | { kind: "add_card"; publishableKey: string }
  | { kind: "pending" };

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

export function PaymentMethodPlain(props: PaymentMethodPlainProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
          Payment method
        </h2>
        {props.kind === "card_on_file" && !showUpdateForm && (
          <button
            type="button"
            onClick={() => setShowUpdateForm(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "#374151",
              background: "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              transition: "background 150ms",
            }}
            className="hover:bg-black/[0.05]"
          >
            <ArrowsClockwise size={12} weight="bold" />
            Change card
          </button>
        )}
      </div>

      {props.kind === "pending" && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Acknowledge the pricing terms below to add a card.
        </div>
      )}

      {props.kind === "card_on_file" && !showUpdateForm && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
            borderRadius: 10,
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.10)",
          }}
        >
          <CreditCard size={28} weight="duotone" color="#6b7280" />
          <div style={{ flex: 1 }}>
            {props.card ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {brandLabel(props.card.brand)} ····{" "}
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{props.card.last4}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  Expires {String(props.card.expMonth).padStart(2, "0")}/
                  {String(props.card.expYear).slice(-2)}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Card on file</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  Your saved card is ready for billing.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(props.kind === "add_card" || (props.kind === "card_on_file" && showUpdateForm)) && (
        <CardCaptureForm
          publishableKey={(props as { publishableKey: string }).publishableKey}
        />
      )}

      {props.kind !== "pending" && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <Lock size={13} weight="regular" />
            Securely stored by Stripe. We never see your card details.
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              lineHeight: 1.55,
            }}
          >
            This card will be charged on the 1st of each month for the previous month&apos;s exchanges.
          </div>
        </>
      )}
    </section>
  );
}

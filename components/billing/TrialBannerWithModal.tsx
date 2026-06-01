"use client";

// components/billing/TrialBannerWithModal.tsx
//
// Client-island wrapper used by PaymentMethodNudge (server component).
// The server side determines whether the banner should show at all
// (agency trial conditions + no card); this client child renders the
// banner JSX and holds the modal-open state.
//
// Clicking the Add card button opens TrialExpiredModal directly on its
// card step (source="hub"). Saving the card triggers router.refresh()
// inside the modal so this banner re-evaluates server-side and
// disappears once stripeCustomerId is set.

import { useState } from "react";
import { TrialExpiredModal } from "./TrialExpiredModal";

type Props = {
  publishableKey: string;
};

export function TrialBannerWithModal({ publishableKey }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        // .agent-reveal-in: subtle 150ms ease-out mount fade. Reduced-motion
        // override at the CSS layer means no inline guard needed.
        className="agent-reveal-in"
        style={{
          background: "var(--agent-card-bg, white)",
          border: "1px solid var(--agent-border, #e5e7eb)",
          borderLeft: "4px solid var(--agent-coral)",
          borderRadius: 8,
          padding: "14px 18px",
          margin: "0",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--agent-text-primary, #111827)" }}>
            Set up billing
          </div>
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary, #6b7280)", marginTop: 3, lineHeight: 1.5 }}>
            Your trial has ended. Add a card to keep adding sales. We&apos;ll only charge your account on exchange.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: "var(--agent-coral)",
            color: "white",
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            border: "none",
            cursor: "pointer",
          }}
        >
          Add card →
        </button>
      </div>

      {open && (
        <TrialExpiredModal
          publishableKey={publishableKey}
          source="hub"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

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
import type { TermsSection } from "@/lib/billing/terms-sections";

type Props = {
  publishableKey: string;
  termsAcknowledged: boolean;
  termsVersionId: string | null;
  termsVersionTag: string | null;
  termsSections: TermsSection[];
};

export function TrialBannerWithModal({
  publishableKey,
  termsAcknowledged,
  termsVersionId,
  termsVersionTag,
  termsSections,
}: Props) {
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
            Add a card for your outsourced sales
          </div>
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary, #6b7280)", marginTop: 3, lineHeight: 1.5 }}>
            You&apos;ve sent sales to us to progress. Add a card so we can bill those on exchange. The sales you run yourself stay free.
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
          termsAcknowledged={termsAcknowledged}
          termsVersionId={termsVersionId}
          termsVersionTag={termsVersionTag}
          termsSections={termsSections}
        />
      )}
    </>
  );
}

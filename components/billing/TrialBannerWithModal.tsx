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
          // --agent-banner-bg is theme-aware (white in light, dark slate in
          // the dark/obsidian shell); the previous --agent-card-bg was
          // undefined so it fell back to hard white and never darkened, which
          // also left the near-white text unreadable. Blur + coral (→ cyan in
          // the dark shell) accent mirror the canonical AgentBanner recipe.
          background: "var(--agent-banner-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(var(--agent-coral-base-rgb), 0.22)",
          borderLeft: "4px solid var(--agent-coral)",
          borderRadius: 10,
          padding: "14px 18px",
          margin: "0",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--agent-text-primary)" }}>
            Add a card to outsource more sales
          </div>
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 3, lineHeight: 1.5 }}>
            Your first outsourced sale is free. To send us another, add a payment card. You&rsquo;ll only be charged when the sale exchanges.
          </div>
        </div>
        {/* Canonical themed button — coral in light, cyan in the dark shell,
            with the shared press/hover states. Matches the header's New sale. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
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

"use client";

// The add-a-card gate: shown when a business tries to add a sale with no card on
// file (once collection is live). Built on the canonical Modal primitive (theme-
// aware chrome: coral top line, close button, backdrop) so it matches the rest of
// the app. Shows the plan, the pro-rated "Due today" figure + next payment date,
// then the Stripe card form (BusinessCardCapture). On a saved card the page
// refreshes, billing goes active, and the sale can be added.

import { Modal } from "@/components/ui/Modal";
import { BusinessCardCapture } from "./BusinessCardCapture";

// Plain, client-safe shape mirrored from BusinessFirstChargePreview
// (lib/progression/business-billing.ts). Passed in from the server page.
export type CardGatePreview = {
  dueTodayPence: number;
  daysLeft: number;
  monthLabel: string;
  nextPaymentLabel: string;
  basePence: number;
  perSalePence: number;
  perMemberPence: number;
};

// Whole pounds show no decimals (£59); a fractional amount shows 2dp (£43.77).
function gbp(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

export function AddCardGateModal({
  publishableKey,
  onClose,
  preview = null,
}: {
  publishableKey: string;
  onClose: () => void;
  preview?: CardGatePreview | null;
}) {
  const basePence = preview?.basePence ?? 5900;
  const perSalePence = preview?.perSalePence ?? 500;
  const perMemberPence = preview?.perMemberPence ?? 3900;

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    padding: "11px 14px", fontSize: 12.5, color: "var(--agent-text-secondary)",
    borderTop: "1px solid var(--agent-border-subtle)",
  };
  const amt: React.CSSProperties = { fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const per: React.CSSProperties = { fontWeight: 600, color: "var(--agent-text-muted)", fontSize: 11.5 };

  return (
    <Modal open onClose={onClose} ariaLabel="Add a payment card" size="md">
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 24px 22px" }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)", marginBottom: 7 }}>
          Activate your plan
        </span>
        <h3 style={{ margin: 0, paddingRight: 28, fontSize: 20, lineHeight: 1.2, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
          Add a card to start adding sales
        </h3>
        <p style={{ margin: "9px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: "40ch" }}>
          Add a payment card to activate your plan. You can add or remove sales and team members at any time.
        </p>

        {/* Plan */}
        <div style={{ margin: "18px 0 0", border: "1px solid var(--agent-border-default)", borderRadius: 13, overflow: "hidden", background: "rgba(var(--agent-coral-rgb),0.02)" }}>
          <div style={{ ...rowBase, borderTop: "none", background: "rgba(var(--agent-coral-rgb),0.07)" }}>
            <span style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>Your plan</span>
            <span style={{ ...amt, color: "var(--agent-coral-deep)" }}>{gbp(basePence)} <i style={{ ...per, color: "var(--agent-coral)", fontStyle: "normal" }}>/ month</i></span>
          </div>
          <div style={rowBase}>
            <span>Each sale added</span>
            <span style={amt}>{gbp(perSalePence)}</span>
          </div>
          <div style={rowBase}>
            <span>Each extra team member</span>
            <span style={amt}>{gbp(perMemberPence)} <i style={{ ...per, fontStyle: "normal" }}>/ month</i></span>
          </div>
        </div>

        {/* Due today (pro-rata) */}
        {preview && (
          <div style={{ marginTop: 12, border: "1px solid rgba(var(--agent-coral-rgb),0.22)", borderRadius: 12, padding: "14px 15px", background: "rgba(var(--agent-coral-rgb),0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Due today</span>
              <span style={{ fontSize: 26, fontWeight: 850, color: "var(--agent-coral-deep)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1 }}>{gbp(preview.dueTodayPence)}</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--agent-text-muted)" }}>
              Pro-rated for the remaining <b style={{ color: "var(--agent-text-secondary)", fontWeight: 700 }}>{preview.daysLeft} days</b> of {preview.monthLabel}.<br />
              Your next payment is {gbp(basePence)} on <b style={{ color: "var(--agent-text-secondary)", fontWeight: 700 }}>{preview.nextPaymentLabel}</b>, then monthly thereafter.
            </p>
          </div>
        )}

        {/* Card form */}
        <div style={{ marginTop: 18 }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 9, letterSpacing: "0.01em" }}>Card details</span>
          <BusinessCardCapture publishableKey={publishableKey} />
        </div>

        {/* Trust */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 11, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--agent-success, #1F8A4A)" strokeWidth="1.8" style={{ flexShrink: 0, marginTop: 1 }}>
            <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>Securely processed by Stripe. We never see or store your card details.</span>
        </div>
      </div>
    </Modal>
  );
}

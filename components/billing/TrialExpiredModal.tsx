// components/billing/TrialExpiredModal.tsx
//
// Rendered in place of the New Sale form when a director navigates to
// /agent/transactions/new-v2 but their agency's 14-day free trial has
// elapsed without a card being added.
//
// Trigger conditions (all must be true — checked at page level):
//   - session.user.role === "director"
//   - agency.firstSubmissionAt is set (they've actually used the trial)
//   - 14+ days elapsed since firstSubmissionAt
//   - agency.stripeCustomerId is null (no card yet)
//
// Pure server component. No client JS. Two link CTAs:
//   - "Add a card" → /agent/account/billing#payment-method
//   - "Back to dashboard" → /agent/hub
//
// Visual: full-content-area overlay (fixed positioning) on a dimmed
// backdrop. Card centered. Matches the BillingNegotiatorModal pattern
// for design consistency.

import Link from "next/link";

export function TrialExpiredModal() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          maxWidth: 480,
          width: "100%",
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
        }}
      >
        {/* Coral icon chip — matches the rest of the agent design language */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "rgba(255,107,74,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--agent-coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2
          id="trial-expired-title"
          style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}
        >
          Your free trial has ended
        </h2>

        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
          You&apos;ve made the most of your 14-day free trial. Existing files keep running normally — chases, comms, milestones, everything. To add new sales, we need a card on file so we can collect the per-sale fee when each one exchanges.
        </p>

        <div
          style={{
            margin: "20px 0 0",
            padding: "12px 14px",
            background: "rgba(255,107,74,0.06)",
            border: "0.5px solid rgba(255,107,74,0.25)",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#7f1d1d",
          }}
        >
          <strong style={{ color: "var(--agent-coral)" }}>Nothing&apos;s charged today.</strong>{" "}
          You&apos;re only billed when a sale exchanges — never on creation, never on cancellation.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>
          <Link
            href="/agent/account/billing#payment-method"
            style={{
              background: "var(--agent-coral)",
              color: "white",
              padding: "13px 18px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Add a card to continue
          </Link>
          <Link
            href="/agent/hub"
            style={{
              background: "white",
              color: "#6b7280",
              padding: "12px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textAlign: "center",
              textDecoration: "none",
              border: "1px solid #e5e7eb",
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

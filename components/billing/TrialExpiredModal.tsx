// components/billing/TrialExpiredModal.tsx
//
// Rendered in place of the New Sale form when a director navigates to
// /agent/transactions/new-v2 but their agency's 14-day free trial has
// elapsed without a card being added.
//
// Trigger conditions (all must be true, checked at page level):
//   - session.user.role === "director"
//   - agency.firstSubmissionAt is set (they've actually used the trial)
//   - 14+ days elapsed since firstSubmissionAt
//   - agency.stripeCustomerId is null (no card yet)
//
// Pure server component. No client JS. Two link CTAs:
//   - "Add a card to continue" → /agent/account/billing#payment-method
//   - "Back to dashboard" → /agent/hub
//
// Motion + chrome use the canonical agent-modal / agent-backdrop-overlay
// classes from app/agent/styles/agent-system.css. agent-modal handles the
// fade + scale entrance via the agent-modal-in keyframe (250ms,
// var(--agent-ease)) and the reduced-motion override is applied at the
// CSS layer, not inline. Matches ClaimWelcomeModal / AddFirmModal motion.

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Backdrop: dim + blur, fades in via .agent-backdrop-overlay */}
      <div className="fixed inset-0 agent-backdrop-overlay" aria-hidden />

      <div
        className="agent-modal"
        style={{
          maxWidth: 480,
          width: "calc(100vw - 48px)",
          position: "relative",
          padding: 32,
        }}
      >
        {/* Card icon chip on a coral surface. Swapped from the earlier
            padlock (padlock read as "locked out" and fought the calm
            tone). Inline SVG keeps the file self-contained. */}
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
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--agent-coral)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2.5" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="6" y1="15" x2="9" y2="15" />
          </svg>
        </div>

        <h2
          id="trial-expired-title"
          style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}
        >
          Your free trial has ended
        </h2>

        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
          Your two-week trial has flown by. The sales you added during it keep running, free through to exchange, just as promised. To add new ones, add a card.
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
          New sales are only billed when they exchange, never when you add one, and never if it falls through.
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

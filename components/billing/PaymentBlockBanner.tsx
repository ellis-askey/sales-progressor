// components/billing/PaymentBlockBanner.tsx
//
// Director-facing banner shown on /agent/hub when the agency has a failed
// payment. Two visible states, mirroring lib/billing/payment-block.ts:
//   - warning: payment failed, grace period still open. Soft amber.
//   - blocked: 7 days elapsed, new file creation refused server-side. Red.
//
// Negotiators never see this — the parent page restricts rendering to
// directors. (Negotiators don't see prices or billing at all per the locked
// model.)
//
// Server component (no client state). On the hub it sits below the page
// header, above the existing content.

import Link from "next/link";
import { getPaymentBlockState } from "@/lib/billing/payment-block";

export async function PaymentBlockBanner({ agencyId }: { agencyId: string }) {
  const state = await getPaymentBlockState(agencyId);
  if (state.kind === "ok") return null;

  const isBlocked = state.kind === "blocked";
  const failedDate = state.paymentFailedAt.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  if (isBlocked) {
    return (
      <div
        role="alert"
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderLeft: "4px solid #dc2626",
          borderRadius: 8,
          padding: "14px 18px",
          margin: "12px 0",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#991b1b" }}>
            New file creation paused — update your card
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 4, lineHeight: 1.5 }}>
            A payment from {failedDate} hasn't been collected. Existing files keep running, but you can't add new sales until the card is updated.
          </div>
        </div>
        <Link
          href="/agent/billing/payment-method"
          style={{
            background: "#dc2626", color: "white", padding: "8px 14px",
            borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none",
            alignSelf: "center", whiteSpace: "nowrap",
          }}
        >
          Update card →
        </Link>
      </div>
    );
  }

  // warning state
  const graceEndDate = state.gracePeriodEndsAt.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  return (
    <div
      role="alert"
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderLeft: "4px solid #d97706",
        borderRadius: 8,
        padding: "14px 18px",
        margin: "12px 0",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#92400e" }}>
          A payment failed — please update your card
        </div>
        <div style={{ fontSize: 13, color: "#78350f", marginTop: 4, lineHeight: 1.5 }}>
          A payment from {failedDate} didn't go through. We'll keep retrying. If it's not resolved by {graceEndDate}, new file creation will be paused.
        </div>
      </div>
      <Link
        href="/agent/billing/payment-method"
        style={{
          background: "#d97706", color: "white", padding: "8px 14px",
          borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none",
          alignSelf: "center", whiteSpace: "nowrap",
        }}
      >
        Update card →
      </Link>
    </div>
  );
}

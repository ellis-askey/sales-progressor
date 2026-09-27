// components/billing/PaymentBlockBanner.tsx
//
// Director-facing banner shown on /agent/hub when the agency has a failed
// payment. Two visible states, mirroring lib/billing/payment-block.ts:
//   - warning: payment failed, grace period still open (amber).
//   - blocked: 7 days elapsed, new file creation refused server-side (red).
//
// Negotiators never see this — the parent page restricts rendering to
// directors. (Negotiators don't see prices or billing at all per the locked
// model.)
//
// Server component (no client state). Uses the shared "grouped inset" banner
// material (critique #13) so it reads as one system with AgentBanner; it can't
// use AgentBanner directly because its CTA is a navigation Link, not an onClick.

import Link from "next/link";
import { WarningOctagon, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { getPaymentBlockState } from "@/lib/billing/payment-block";

export async function PaymentBlockBanner({ agencyId }: { agencyId: string }) {
  const state = await getPaymentBlockState(agencyId);
  if (state.kind === "ok") return null;

  const failedDate = state.paymentFailedAt.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const blocked = state.kind === "blocked";
  const tint = blocked ? "var(--agent-danger)" : "var(--agent-warning)";
  const title = blocked
    ? "New file creation paused. Update your card."
    : "A payment failed. Please update your card.";
  const body = state.kind === "blocked"
    ? `A payment from ${failedDate} hasn't been collected. Existing files keep running, but you can't add new sales until the card is updated.`
    : `A payment from ${failedDate} didn't go through. We'll keep retrying. If it's not resolved by ${state.gracePeriodEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, new file creation will be paused.`;

  return (
    <div
      role="alert"
      className="agent-reveal-in"
      style={{
        background: "var(--agent-banner-mat-bg, rgba(255,255,255,0.55))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--agent-banner-mat-border, rgba(255,255,255,0.7))",
        borderRadius: 18,
        boxShadow:
          "var(--agent-banner-mat-shadow, 0 10px 30px rgba(15,26,46,0.12)), inset 0 1px 0 var(--agent-banner-mat-highlight, rgba(255,255,255,0.4))",
        padding: "15px 17px",
        margin: "12px 0",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, marginTop: 1, color: tint, display: "flex" }}>
        {blocked ? <WarningOctagon size={19} weight="fill" /> : <WarningCircle size={19} weight="fill" />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
          {title}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
      <Link
        href="/agent/account/billing#payment-method"
        style={{
          flexShrink: 0, alignSelf: "center", whiteSpace: "nowrap",
          fontSize: 12, fontWeight: 600, color: tint, textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        Update card <LinkArrow />
      </Link>
    </div>
  );
}

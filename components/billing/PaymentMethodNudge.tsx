// components/billing/PaymentMethodNudge.tsx
//
// Hub card nudging directors to add a payment method once their trial window
// has had time to pass naturally. Designed to be unobtrusive — not modal,
// not flashy, not waved-in-face on day one.
//
// Trigger (all must be true):
//   - role = director (negotiators get the modal flow instead; both checked
//     at the call site)
//   - Agency has no stripeCustomerId yet (no card on file)
//   - Agency has a firstSubmissionAt — i.e. has submitted at least one file
//   - >= 21 days have elapsed since firstSubmissionAt — past the 14-day trial
//     plus another week of grace before we start mentioning billing setup
//   - Hides itself otherwise (server-component, returns null)
//
// Visual: small inline card matching the hub aesthetic. Coral accent on the
// left border, not a full coral background. Single CTA "Set up billing".
// No dismiss — director either acts or ignores; once stripeCustomerId is set
// the card self-hides.

import Link from "next/link";
import { prisma } from "@/lib/prisma";

const NUDGE_THRESHOLD_MS = 21 * 24 * 60 * 60 * 1000;

export async function PaymentMethodNudge({ agencyId }: { agencyId: string }) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { firstSubmissionAt: true, stripeCustomerId: true },
  });
  if (!agency) return null;
  if (agency.stripeCustomerId) return null;       // card already on file
  if (!agency.firstSubmissionAt) return null;     // never submitted — too early to nudge
  const elapsed = Date.now() - agency.firstSubmissionAt.getTime();
  if (elapsed < NUDGE_THRESHOLD_MS) return null;  // inside trial + 7d grace

  return (
    <div
      style={{
        background: "var(--agent-card-bg, white)",
        border: "1px solid var(--agent-border, #e5e7eb)",
        borderLeft: "4px solid var(--agent-primary, #FF6B4A)",
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
          Your trial has finished. Add a card so we can collect the per-sale fee when each file exchanges. Nothing's charged until then.
        </div>
      </div>
      <Link
        href="/agent/billing#payment-method"
        style={{
          background: "var(--agent-primary, #FF6B4A)", color: "white",
          padding: "8px 14px", borderRadius: 6,
          fontSize: 13, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Add card →
      </Link>
    </div>
  );
}

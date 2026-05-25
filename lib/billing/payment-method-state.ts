// lib/billing/payment-method-state.ts
//
// Server-side state machine for /agent/billing/payment-method. The page
// renders the right UI based on what this returns. Verifier asserts the
// state transitions without needing a browser.
//
// Four states, in checked order:
//   - "stripe_not_configured": missing Stripe env vars. Shouldn't happen
//      in prod (env set in Vercel) but caught here to surface a clean
//      message rather than a 500 on import.
//   - "pending": TermsVersion table is empty (the PR 6 ship state — terms
//      copy from Ellis comes later). Form blocked structurally.
//   - "disclosure": active TermsVersion exists, agency hasn't acknowledged
//      it. Show disclosure body + acknowledge button.
//   - "card_form": active TermsVersion exists and agency has acknowledged
//      it. Show Stripe Elements card capture.

import { isStripeConfigured } from "@/lib/stripe";
import { getActiveTermsVersion, hasAcknowledged, type ActiveTermsVersion } from "@/lib/billing/acknowledgement";

export type PaymentMethodState =
  | { kind: "stripe_not_configured" }
  | { kind: "pending" }
  | { kind: "disclosure"; terms: ActiveTermsVersion }
  | { kind: "card_form"; terms: ActiveTermsVersion };

export async function getPaymentMethodState(agencyId: string): Promise<PaymentMethodState> {
  if (!isStripeConfigured()) return { kind: "stripe_not_configured" };

  const terms = await getActiveTermsVersion();
  if (!terms) return { kind: "pending" };

  const acknowledged = await hasAcknowledged(agencyId, terms.id);
  if (!acknowledged) return { kind: "disclosure", terms };

  return { kind: "card_form", terms };
}

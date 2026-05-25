// app/agent/billing/payment-method/page.tsx
//
// Permanent redirect to /agent/account/billing#payment-method. The
// standalone payment-method page existed during PRs 5-7 as a separate
// surface; the billing-hub transplant collapsed it into a section on
// /agent/billing, and the Account-area arc (Stage 6) retired that hub
// in favour of /agent/account/billing.
//
// Preserved as a redirect so:
//   - Director bookmarks pointing here still work
//   - The PaymentBlockBanner / PaymentMethodNudge / 402-error CTAs that
//     pre-dated the consolidation continue to land in the right place
//     (now updated to point at /agent/account/billing#payment-method
//     directly, but defence-in-depth)
//   - Stripe Elements' return_url after card capture flows through here
//
// Note: redirects directly to /agent/account/billing#payment-method
// (single hop). Routing through the older /agent/billing target would
// chain through the Stage 6 next.config redirect — two hops. The
// direct target is faster and preserves the anchor cleanly.

import { redirect } from "next/navigation";

export default function PaymentMethodRedirect() {
  redirect("/agent/account/billing#payment-method");
}

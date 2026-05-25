// app/agent/billing/payment-method/page.tsx
//
// Permanent redirect to /agent/billing#payment-method. The standalone
// payment-method page existed during PRs 5-7 as a separate surface; the
// billing-hub transplant collapsed it into a section on /agent/billing.
//
// Preserved as a redirect so:
//   - Director bookmarks pointing here still work
//   - The PaymentBlockBanner / PaymentMethodNudge / 402-error CTAs that
//     pre-dated the consolidation continue to land in the right place
//     (now updated to point at /agent/billing#payment-method directly,
//     but defence-in-depth)
//   - Stripe Elements' return_url after card capture flows through here

import { redirect } from "next/navigation";

export default function PaymentMethodRedirect() {
  redirect("/agent/billing#payment-method");
}

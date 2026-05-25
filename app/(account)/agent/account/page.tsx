// app/(account)/agent/account/page.tsx
//
// Bare /agent/account/ redirects into the first tab. Stage 1: only
// Billing exists. When Profile lands (Stage 2) we'll re-evaluate
// whether the index should pick the first role-visible tab dynamically
// — until then, a static redirect is fine and matches Stripe / Vercel
// "no bare account page" convention.

import { redirect } from "next/navigation";

export default function AccountIndexPage() {
  redirect("/agent/account/billing");
}

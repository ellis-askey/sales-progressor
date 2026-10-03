// POST /api/billing/business/setup-intent
//
// Card capture for a progression business (its own Stripe customer). Mirrors the
// agency setup-intent, owner-scoped. GATED: refuses unless both the progression
// feature flag AND the collection switch are on — so no card is ever asked for
// while billing is dark. Returns a SetupIntent client_secret for Stripe Elements.

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { ensureStripeCustomerForBusiness } from "@/lib/progression/business-stripe";

export async function POST(_req: NextRequest) {
  if (!progressionBusinessesEnabled() || !progressionBillingCollectEnabled()) {
    return NextResponse.json({ error: "Billing is not live yet" }, { status: 404 });
  }
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can do this" }, { status: 403 });

  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const customerId = await ensureStripeCustomerForBusiness(owner.businessId);
  if (!customerId) return NextResponse.json({ error: "Could not set up billing" }, { status: 500 });

  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session", // charged later by the subscription + per-sale items
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret, customerId });
}

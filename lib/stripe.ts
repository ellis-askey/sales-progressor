// lib/stripe.ts
//
// Lazy server-side Stripe client. Constructed on first access so that
// importing this module doesn't crash if STRIPE_SECRET_KEY is missing — the
// payment-method page handles the "not configured" state by surfacing a
// clear blocked message rather than 500-ing the request.
//
// Two callers in PR 6:
//   - app/api/billing/setup-intent: creates Stripe Customers + SetupIntents
//   - lib/billing/payment-method-state: probes whether Stripe is configured
//
// PR 7 will add the webhook handler + charging logic on top of this same client.

import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // No apiVersion pin in PR 6 — we're only using SetupIntents + Customers,
  // which are stable across Stripe API versions. PR 7 will pin a specific
  // version once we depend on webhook event payload shapes.
  cached = new Stripe(key, { typescript: true });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
}

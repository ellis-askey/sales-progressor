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

export type DefaultCard = { brand: string; last4: string; expMonth: number; expYear: number };

// The agency's real card on file, read from Stripe. Returns null when Stripe
// isn't configured (e.g. no keys in this environment), the customer has no
// card, or anything errors — the caller shows a details-free "Card on file"
// state rather than fabricated placeholder digits.
export async function getDefaultCard(stripeCustomerId: string): Promise<DefaultCard | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (!("deleted" in customer)) {
      const dpm = customer.invoice_settings?.default_payment_method;
      if (dpm && typeof dpm !== "string" && dpm.card) {
        return { brand: dpm.card.brand, last4: dpm.card.last4, expMonth: dpm.card.exp_month, expYear: dpm.card.exp_year };
      }
    }
    const pms = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card", limit: 1 });
    const c = pms.data[0]?.card;
    if (c) return { brand: c.brand, last4: c.last4, expMonth: c.exp_month, expYear: c.exp_year };
    return null;
  } catch {
    return null;
  }
}

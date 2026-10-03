// Stripe wiring for business->TSP billing (Arc B4). DARK by default — every entry
// point here is gated by progressionBillingCollectEnabled() in its CALLER, and the
// functions no-op if Stripe isn't configured or the subscription prices aren't set.
// Nothing charges until the collect flag is on AND the Stripe prices + card exist.
//
// Model: a Stripe subscription (base price £59 qty 1 + seat price £39 qty = extra
// members) handles the recurring charge; the £5 per-sale charges are pushed as
// one-off pending invoice items that ride the subscription's next invoice.
//
// Go-live (founder, see ELLIS_MANUAL_TODO): create two recurring Stripe Prices
// (£59/mo, £39/mo) + set STRIPE_PRICE_BUSINESS_BASE / STRIPE_PRICE_BUSINESS_SEAT,
// set PROGRESSION_BILLING_COLLECT=true, then verify end-to-end in Stripe TEST mode
// before production. This code is written but NOT yet run against Stripe.

import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { getBusinessBillingSummary, BUSINESS_PER_SALE_PENCE } from "./business-billing";

function basePriceId(): string | undefined { return process.env.STRIPE_PRICE_BUSINESS_BASE; }
function seatPriceId(): string | undefined { return process.env.STRIPE_PRICE_BUSINESS_SEAT; }

/** Create (or reuse) the business's Stripe customer. Returns null if Stripe is
 *  unconfigured or the business is missing. Mirrors the agency setup-intent path. */
export async function ensureStripeCustomerForBusiness(businessId: string): Promise<string | null> {
  if (!isStripeConfigured()) return null;
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { name: true, stripeCustomerId: true },
  });
  if (!business) return null;
  if (business.stripeCustomerId) return business.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    name: business.name,
    metadata: { progressionBusinessId: businessId },
  });
  await prisma.progressionBusiness.update({ where: { id: businessId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Create or update the business's subscription so its seat quantity matches the
 *  current active member count (£59 base + £39 per extra member). No-op until the
 *  prices are configured. Call after a card is captured and when the team changes. */
export async function syncBusinessSubscription(businessId: string): Promise<void> {
  if (!isStripeConfigured()) return;
  const base = basePriceId();
  const seat = seatPriceId();
  if (!base || !seat) return; // prices not set up yet — stays dark

  const customerId = await ensureStripeCustomerForBusiness(businessId);
  if (!customerId) return;

  const { extraMembers } = await getBusinessBillingSummary(businessId);
  const stripe = getStripeClient();
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });

  if (!business?.stripeSubscriptionId) {
    const items: { price: string; quantity: number }[] = [{ price: base, quantity: 1 }];
    if (extraMembers > 0) items.push({ price: seat, quantity: extraMembers });
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items,
      collection_method: "charge_automatically",
      metadata: { progressionBusinessId: businessId },
    });
    await prisma.progressionBusiness.update({ where: { id: businessId }, data: { stripeSubscriptionId: sub.id } });
    return;
  }

  // Existing subscription — reconcile the seat line to the current headcount.
  const sub = await stripe.subscriptions.retrieve(business.stripeSubscriptionId);
  const seatItem = sub.items.data.find((i) => i.price.id === seat);
  if (extraMembers > 0) {
    if (seatItem) await stripe.subscriptionItems.update(seatItem.id, { quantity: extraMembers });
    else await stripe.subscriptionItems.create({ subscription: sub.id, price: seat, quantity: extraMembers });
  } else if (seatItem) {
    await stripe.subscriptionItems.del(seatItem.id);
  }
}

/** Push any accrued-but-unsent £5 per-sale charges to Stripe as pending invoice
 *  items (they ride the next subscription invoice). Idempotent via
 *  businessPerSaleInvoicedAt. Returns how many were pushed. Intended for a daily
 *  cron once collection is live. */
export async function pushPendingPerSaleItems(businessId: string): Promise<number> {
  if (!isStripeConfigured()) return 0;
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { stripeCustomerId: true },
  });
  if (!business?.stripeCustomerId) return 0;

  const sales = await prisma.propertyTransaction.findMany({
    where: { progressionBusinessId: businessId, businessPerSaleChargedAt: { not: null }, businessPerSaleInvoicedAt: null },
    select: { id: true, propertyAddress: true },
  });
  if (sales.length === 0) return 0;

  const stripe = getStripeClient();
  let pushed = 0;
  for (const s of sales) {
    await stripe.invoiceItems.create({
      customer: business.stripeCustomerId,
      amount: BUSINESS_PER_SALE_PENCE,
      currency: "gbp",
      description: `Sale added — ${s.propertyAddress}`,
      metadata: { progressionBusinessId: businessId, transactionId: s.id },
    });
    await prisma.propertyTransaction.update({ where: { id: s.id }, data: { businessPerSaleInvoicedAt: new Date() } });
    pushed++;
  }
  return pushed;
}

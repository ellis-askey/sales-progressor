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
import { getBusinessBillingSummary, BUSINESS_PER_SALE_PENCE, computeFirstChargeEstimate, type BusinessFirstChargePreview } from "./business-billing";
import { billingMonthRange } from "@/lib/billing/period";

/** Error thrown when a sale is created for an external business that has no
 *  billing set up (no card on file) while collection is live. The action layer
 *  catches this and tells the UI to open the add-a-card prompt. */
export class BillingSetupRequiredError extends Error {
  constructor() {
    super("Add a payment card to start adding sales.");
    this.name = "BillingSetupRequiredError";
  }
}

/** Whether an external business has billing set up (a card on file + active plan).
 *  A subscription only exists after a card was captured (syncBusinessSubscription
 *  promotes the card then creates it), so its presence is our "card on file"
 *  signal. Used by the add-sale / bring-in-a-sale gate once collection is live. */
export async function businessBillingActive(businessId: string): Promise<boolean> {
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });
  return !!business?.stripeSubscriptionId;
}

function basePriceId(): string | undefined { return process.env.STRIPE_PRICE_BUSINESS_BASE; }
function seatPriceId(): string | undefined { return process.env.STRIPE_PRICE_BUSINESS_SEAT; }

/** The EXACT "Due today" the business will be charged the moment they add a card,
 *  straight from Stripe's own proration preview — so the modal figure matches the
 *  charge to the penny (Stripe, not us, decides the clock-change hour + rounding).
 *  Previews the same subscription syncBusinessSubscription creates (base + seats,
 *  billing_cycle_anchor on the 1st, create_prorations). Falls back to our own
 *  by-second estimate if Stripe isn't configured, the prices aren't set, or the
 *  preview errors. The date/label fields always come from the estimate. */
export async function getBusinessFirstChargePreview(businessId: string, now: Date = new Date()): Promise<BusinessFirstChargePreview> {
  const estimate = await computeFirstChargeEstimate(businessId, now);
  const base = basePriceId();
  const seat = seatPriceId();
  if (!isStripeConfigured() || !base || !seat) return estimate;

  try {
    const customerId = await ensureStripeCustomerForBusiness(businessId);
    if (!customerId) return estimate;

    const memberCount = await prisma.user.count({ where: { progressionBusinessId: businessId, deactivatedAt: null } });
    const extraMembers = Math.max(0, memberCount - 1);
    const items: { price: string; quantity: number }[] = [{ price: base, quantity: 1 }];
    if (extraMembers > 0) items.push({ price: seat, quantity: extraMembers });

    const cycleAnchor = Math.floor(billingMonthRange(now).end.getTime() / 1000);
    const stripe = getStripeClient();
    const inv = await stripe.invoices.createPreview({
      customer: customerId,
      subscription_details: {
        items,
        billing_cycle_anchor: cycleAnchor,
        proration_behavior: "create_prorations",
      },
    });
    // amount_due is the pence total Stripe would charge for this first (prorated)
    // invoice — exactly what lands on the card.
    if (typeof inv.amount_due === "number") return { ...estimate, dueTodayPence: inv.amount_due };
  } catch (err) {
    console.error(`[business-billing] exact proration preview failed for ${businessId}:`, err);
  }
  return estimate;
}

/** Create (or reuse) the business's Stripe customer. Returns null if Stripe is
 *  unconfigured or the business is missing. Mirrors the agency setup-intent path. */
export async function ensureStripeCustomerForBusiness(businessId: string): Promise<string | null> {
  if (!isStripeConfigured()) return null;
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { name: true, stripeCustomerId: true },
  });
  if (!business) return null;

  const stripe = getStripeClient();

  // Reuse the stored customer only if it STILL exists in Stripe. If it was
  // deleted (e.g. during testing), self-heal by creating a fresh one rather than
  // failing every call with "No such customer".
  if (business.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(business.stripeCustomerId);
      if (!("deleted" in existing && existing.deleted)) return business.stripeCustomerId;
    } catch {
      // not found / deleted — fall through to create a fresh customer
    }
  }

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

  // The card captured via SetupIntent is attached to the customer but is NOT its
  // default. A charge_automatically subscription has nothing to charge without a
  // default payment method, so promote the customer's most recent card to the
  // default before creating the subscription. (Without this, the first invoice
  // can't be paid and the subscription never completes.)
  const customer = await stripe.customers.retrieve(customerId);
  const existingDefault = "deleted" in customer ? null : customer.invoice_settings?.default_payment_method;
  if (!existingDefault) {
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    if (pms.data[0]) {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pms.data[0].id },
      });
    }
  }

  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });

  // Resolve the subscription id safely. Never create a second subscription: if our
  // record is missing but Stripe already has a live one for this customer (our DB
  // lost the id, or a concurrent run just created it), adopt that one instead.
  let subscriptionId = business?.stripeSubscriptionId ?? null;
  if (!subscriptionId) {
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    const live = existing.data.find((s) => s.status !== "canceled" && s.status !== "incomplete_expired");
    if (live) {
      subscriptionId = live.id;
      await prisma.progressionBusiness.update({ where: { id: businessId }, data: { stripeSubscriptionId: live.id } });
    }
  }

  if (!subscriptionId) {
    const items: { price: string; quantity: number }[] = [{ price: base, quantity: 1 }];
    if (extraMembers > 0) items.push({ price: seat, quantity: extraMembers });
    // Bill on the 1st of each month, pro-rata for the partial first month: anchor
    // the cycle to midnight on the 1st of next month (London) so Stripe charges the
    // prorated remainder of this month on the first invoice now, then the full £59
    // on the 1st each month thereafter.
    const cycleAnchor = Math.floor(billingMonthRange(new Date()).end.getTime() / 1000);
    // Stable idempotency key so a double-click, or the daily cron overlapping the
    // card-save, can't create two subscriptions (and double-charge the £59).
    const sub = await stripe.subscriptions.create(
      {
        customer: customerId,
        items,
        collection_method: "charge_automatically",
        billing_cycle_anchor: cycleAnchor,
        proration_behavior: "create_prorations",
        metadata: { progressionBusinessId: businessId },
      },
      { idempotencyKey: `business-sub-create-${businessId}` },
    );
    await prisma.progressionBusiness.update({ where: { id: businessId }, data: { stripeSubscriptionId: sub.id } });
    return;
  }

  // Existing (or just-adopted) subscription — reconcile the seat line to the
  // current headcount.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
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
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  });
  // Require BOTH a customer and a subscription: a pending invoice item only ever
  // gets collected by riding the next subscription invoice. Pushing with no
  // subscription would strand the item in Stripe while we still marked the sale
  // invoiced, silently losing the £5. No subscription yet means leave them for the
  // next run.
  if (!business?.stripeCustomerId || !business?.stripeSubscriptionId) return 0;

  const sales = await prisma.propertyTransaction.findMany({
    where: { progressionBusinessId: businessId, businessPerSaleChargedAt: { not: null }, businessPerSaleInvoicedAt: null },
    select: { id: true, propertyAddress: true },
  });
  if (sales.length === 0) return 0;

  const stripe = getStripeClient();
  let pushed = 0;
  for (const s of sales) {
    // Idempotency key per sale: if a run is interrupted after creating the item but
    // before marking it invoiced, the retry returns the same item instead of
    // creating (and charging) a second £5.
    await stripe.invoiceItems.create(
      {
        customer: business.stripeCustomerId,
        amount: BUSINESS_PER_SALE_PENCE,
        currency: "gbp",
        description: `Sale added: ${s.propertyAddress}`,
        metadata: { progressionBusinessId: businessId, transactionId: s.id },
      },
      { idempotencyKey: `business-persale-${s.id}` },
    );
    await prisma.propertyTransaction.update({ where: { id: s.id }, data: { businessPerSaleInvoicedAt: new Date() } });
    pushed++;
  }
  return pushed;
}

/** Daily cron body (C1): for every business with a card on file, reconcile its
 *  subscription seat count and push any accrued £5 per-sale items. Each is
 *  per-business isolated so one failure doesn't abort the pass. No-ops if Stripe
 *  isn't configured. The cron route gates this on the collection switch. */
export async function runBusinessBillingCron(): Promise<{ businesses: number; subscriptionsSynced: number; perSalePushed: number; failures: number }> {
  if (!isStripeConfigured()) return { businesses: 0, subscriptionsSynced: 0, perSalePushed: 0, failures: 0 };
  const businesses = await prisma.progressionBusiness.findMany({
    where: { stripeCustomerId: { not: null } },
    select: { id: true },
  });
  let subscriptionsSynced = 0;
  let perSalePushed = 0;
  let failures = 0;
  for (const b of businesses) {
    try { await syncBusinessSubscription(b.id); subscriptionsSynced++; }
    catch (err) { failures++; console.error(`[business-billing] subscription sync failed for ${b.id}:`, err); }
    try { perSalePushed += await pushPendingPerSaleItems(b.id); }
    catch (err) { failures++; console.error(`[business-billing] per-sale push failed for ${b.id}:`, err); }
  }
  return { businesses: businesses.length, subscriptionsSynced, perSalePushed, failures };
}

// POST /api/billing/setup-intent
//
// Creates (or reuses) the agency's Stripe Customer and returns a fresh
// SetupIntent client_secret. The client-side Stripe Elements form uses
// that secret to confirm the card capture — at which point Stripe attaches
// the PaymentMethod to the Customer for future charging (PR 7).
//
// Strict gate: refuses if the agency hasn't acknowledged the active
// TermsVersion. This is the structural safety belt — even if a frontend
// bug skipped the acknowledge UI, the SetupIntent endpoint won't issue.
//
// Validates: director only, agency exists, Stripe configured, terms
// active and acknowledged.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { getActiveTermsVersion, hasAcknowledged } from "@/lib/billing/acknowledgement";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Director only" }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json({ error: "No agency on session" }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  // Structural gate: refuse SetupIntent without an acknowledged active terms.
  const active = await getActiveTermsVersion();
  if (!active) {
    return NextResponse.json({ error: "No active pricing terms" }, { status: 409 });
  }
  if (!(await hasAcknowledged(agencyId, active.id))) {
    return NextResponse.json({ error: "Pricing terms not yet acknowledged" }, { status: 409 });
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!agency) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  const stripe = getStripeClient();

  // Create Stripe Customer on first card capture; persist the id so future
  // calls reuse it. Customer is the long-lived bucket for PaymentMethods +
  // (PR 7) Invoices.
  let customerId = agency.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: agency.name,
      metadata: { agencyId: agency.id },
    });
    customerId = customer.id;
    await prisma.agency.update({
      where: { id: agency.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session", // card will be charged later by the accrual cron
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    customerId,
  });
}

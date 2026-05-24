// POST /api/webhooks/stripe
//
// Stripe webhook endpoint. Verifies the signature using STRIPE_WEBHOOK_SECRET,
// parses the event, then delegates to lib/billing/stripe-webhook for
// processing.
//
// Two endpoints registered (founder action in ELLIS_MANUAL_TODO Step 3a):
//   - Test mode → staging deploy URL → test-mode signing secret
//   - Live mode → production URL → live-mode signing secret
// Same env var name (STRIPE_WEBHOOK_SECRET); different value per env.
//
// Must read the RAW request body for signature verification. Next.js App
// Router gives us that via req.text() — DO NOT use req.json() because the
// JSON serialise/deserialise round-trip would invalidate the signature.

import { type NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { processStripeEvent, type StripeWebhookEvent } from "@/lib/billing/stripe-webhook";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event as unknown as StripeWebhookEvent);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[stripe-webhook] event processing failed:", err, "event id:", event.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 },
    );
  }
}

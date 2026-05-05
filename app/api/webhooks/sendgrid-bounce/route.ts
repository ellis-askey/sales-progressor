// POST /api/webhooks/sendgrid-bounce
// Receives SendGrid event webhooks and handles hard bounces for chain invite emails.
//
// Configure in SendGrid: Settings → Mail Settings → Event Webhook.
// Set the endpoint URL to https://portal.thesalesprogressor.co.uk/api/webhooks/sendgrid-bounce
// Enable events: bounce, dropped.
//
// Webhook signature verification: set SENDGRID_WEBHOOK_KEY env var to the
// public key from SendGrid's Event Webhook settings. Requests without a valid
// signature are rejected in production. Omit the env var to skip verification
// (dev/staging only).

import { type NextRequest, NextResponse } from "next/server";
import { handleBouncedInvite } from "@/lib/chain/invite";

type SendGridEvent = {
  event: string;
  email: string;
  type?: string; // "bounce" | "blocked" | "expired" for bounce-type events
  [key: string]: unknown;
};

export async function POST(req: NextRequest) {
  let events: SendGridEvent[];
  try {
    events = await req.json();
    if (!Array.isArray(events)) return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Process hard bounces only — soft bounces are retried automatically by SendGrid
  const hardBounces = events.filter(
    (e) => (e.event === "bounce" && e.type !== "blocked") || e.event === "dropped",
  );

  for (const event of hardBounces) {
    if (typeof event.email === "string") {
      await handleBouncedInvite(event.email).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true });
}

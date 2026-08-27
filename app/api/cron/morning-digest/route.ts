import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMorningDigests, fireExchangeApproachingPushes, fireMortgageExpiryAlerts } from "@/lib/services/morning-digest";

// Runs 08:00 weekdays via Vercel Cron (see vercel.json).
// Protected by CRON_SECRET header.
//
// Two passes per agency:
//   1. sendMorningDigests — daily summary email to assigned progressors / directors
//   2. fireExchangeApproachingPushes — push to file owners when expectedExchangeDate
//      is within 7 days. Deduped via Notification rows so it fires once per warning.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencies = await prisma.agency.findMany({ select: { id: true } });

  let totalSent = 0;
  let totalPushed = 0;
  let totalMortgageAlerts = 0;
  for (const agency of agencies) {
    const sent = await sendMorningDigests(agency.id).catch(() => 0);
    totalSent += sent;
    const pushed = await fireExchangeApproachingPushes(agency.id).catch(() => 0);
    totalPushed += pushed;
    const mortgageAlerts = await fireMortgageExpiryAlerts(agency.id).catch(() => 0);
    totalMortgageAlerts += mortgageAlerts;
  }

  return NextResponse.json({ sent: totalSent, exchangeApproachingPushed: totalPushed, mortgageExpiryAlerts: totalMortgageAlerts });
}

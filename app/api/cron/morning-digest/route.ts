import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMorningDigests, fireExchangeApproachingPushes, fireMortgageExpiryAlerts } from "@/lib/services/morning-digest";
import { runJob } from "@/lib/cron/run-job";

// Fires every 15 minutes across the morning window (see vercel.json) and only
// runs when London local time is 08:30. Vercel Cron is UTC and the UK clock
// shifts (BST/GMT), so no single UTC time hits 08:30 year-round — this gate does.
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

  // Only run at 08:30 UK time (once per day). Other 15-minute fires no-op.
  // ?force=1 bypasses the gate for on-demand testing (still secret-protected).
  const force = req.nextUrl.searchParams.get("force") === "1";
  const lon = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const lh = Number(lon.find((p) => p.type === "hour")?.value);
  const lm = Number(lon.find((p) => p.type === "minute")?.value);
  if (!force && !(lh === 8 && lm >= 30 && lm < 45)) {
    return NextResponse.json({ skipped: true, reason: `not 08:30 London (currently ${lh}:${String(lm).padStart(2, "0")})` });
  }

  return runJob("morning-digest", async () => {
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
  });
}

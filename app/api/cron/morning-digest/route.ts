import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendMorningDigests, fireExchangeApproachingPushes, flushExchangeApproachingPushes, fireMortgageExpiryAlerts, type ExchangePushSink } from "@/lib/services/morning-digest";
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
    let failures = 0;
    // Shared across every agency so one owner's exchange-soon alerts digest into
    // a single push for the whole run, not one per agency (critique #296).
    const exchangeSink: ExchangePushSink = new Map();
    // AUTO-004 (audit full-audit-2026-10): a failing agency used to be dropped
    // silently (.catch(() => 0)), so a stuck digest left clients hearing nothing
    // with no trace. Log + Sentry per agency so the breakage is visible, then
    // carry on so one bad agency never stalls the rest of the run.
    const guard = async <T>(agencyId: string, step: string, work: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await work;
      } catch (err) {
        failures++;
        console.error(`[morning-digest] ${step} failed agency=${agencyId}:`, err);
        Sentry.captureException(err, { tags: { cron: "morning-digest", step }, extra: { agencyId } });
        return fallback;
      }
    };
    for (const agency of agencies) {
      totalSent += await guard(agency.id, "sendMorningDigests", sendMorningDigests(agency.id), 0);
      totalPushed += await guard(agency.id, "fireExchangeApproachingPushes", fireExchangeApproachingPushes(agency.id, exchangeSink), 0);
      totalMortgageAlerts += await guard(agency.id, "fireMortgageExpiryAlerts", fireMortgageExpiryAlerts(agency.id), 0);
    }
    // One digest-or-single push per owner, now that every agency has contributed.
    flushExchangeApproachingPushes(exchangeSink);

    return NextResponse.json({ sent: totalSent, exchangeApproachingPushed: totalPushed, mortgageExpiryAlerts: totalMortgageAlerts, failures });
  });
}

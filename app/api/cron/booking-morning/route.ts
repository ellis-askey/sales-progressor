import { NextRequest, NextResponse } from "next/server";
import { sendBookingMorningReminders } from "@/lib/services/booking-reminders";
import { runJob } from "@/lib/cron/run-job";

// Morning-of survey / lender-valuation reminders to the agency agent.
//
// Fires every 15 minutes across the early window (see vercel.json) and only runs
// when London local time is 07:00. Vercel Cron is UTC and the UK clock shifts
// (BST/GMT), so no single UTC time hits 07:00 year-round — this gate does. Same
// pattern as morning-digest (which gates 08:30). Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run at 07:00 UK (the first quarter-hour fire). ?force=1 bypasses the
  // gate for on-demand testing (still secret-protected).
  const force = req.nextUrl.searchParams.get("force") === "1";
  const lon = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const lh = Number(lon.find((p) => p.type === "hour")?.value);
  const lm = Number(lon.find((p) => p.type === "minute")?.value);
  if (!force && !(lh === 7 && lm < 15)) {
    return NextResponse.json({ skipped: true, reason: `not 07:00 London (currently ${lh}:${String(lm).padStart(2, "0")})` });
  }

  return runJob("booking-morning", async () => {
    const sent = await sendBookingMorningReminders();
    return NextResponse.json({ sent });
  });
}

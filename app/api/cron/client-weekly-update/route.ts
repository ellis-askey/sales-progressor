import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendClientWeeklyUpdates } from "@/lib/services/client-weekly-update";
import { runJob } from "@/lib/cron/run-job";

// Runs Saturday 09:00 UTC via Vercel Cron (see vercel.json).
// Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("client-weekly-update", async () => {
    const agencies = await prisma.agency.findMany({ select: { id: true } });

    let totalSent = 0;
    let failures = 0;
    // AUTO-004 (audit full-audit-2026-10): a failing agency used to be dropped
    // silently, so clients could stop hearing from TSP with no trace. Log +
    // Sentry per agency, then carry on with the rest of the run.
    for (const agency of agencies) {
      try {
        totalSent += await sendClientWeeklyUpdates(agency.id);
      } catch (err) {
        failures++;
        console.error(`[client-weekly-update] failed agency=${agency.id}:`, err);
        Sentry.captureException(err, { tags: { cron: "client-weekly-update" }, extra: { agencyId: agency.id } });
      }
    }

    return NextResponse.json({ sent: totalSent, failures });
  });
}

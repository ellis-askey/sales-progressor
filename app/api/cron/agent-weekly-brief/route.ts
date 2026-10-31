import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendAgentWeeklyBriefs } from "@/lib/services/agent-weekly-brief";
import { runJob } from "@/lib/cron/run-job";

// Runs Monday 07:00 UTC via Vercel Cron (see vercel.json).
// Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("agent-weekly-brief", async () => {
    const agencies = await prisma.agency.findMany({ select: { id: true } });

    let totalSent = 0;
    let failures = 0;
    // AUTO-004 (audit full-audit-2026-10): surface a failing agency instead of
    // dropping it silently, then carry on with the rest of the run.
    for (const agency of agencies) {
      try {
        totalSent += await sendAgentWeeklyBriefs(agency.id);
      } catch (err) {
        failures++;
        console.error(`[agent-weekly-brief] failed agency=${agency.id}:`, err);
        Sentry.captureException(err, { tags: { cron: "agent-weekly-brief" }, extra: { agencyId: agency.id } });
      }
    }

    return NextResponse.json({ sent: totalSent, failures });
  });
}

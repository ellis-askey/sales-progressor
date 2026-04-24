import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAgentWeeklyBriefs } from "@/lib/services/agent-weekly-brief";

// Runs Monday 07:00 UTC via Vercel Cron (see vercel.json).
// Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencies = await prisma.agency.findMany({ select: { id: true } });

  let totalSent = 0;
  for (const agency of agencies) {
    const sent = await sendAgentWeeklyBriefs(agency.id).catch(() => 0);
    totalSent += sent;
  }

  return NextResponse.json({ sent: totalSent });
}

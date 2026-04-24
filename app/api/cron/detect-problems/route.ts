import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectAndStoreFlags } from "@/lib/services/problem-detection";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencies = await prisma.agency.findMany({ select: { id: true } });
  let total = 0;

  for (const agency of agencies) {
    const count = await detectAndStoreFlags(agency.id).catch((err) => {
      console.error(`[detect-problems] agency ${agency.id}:`, err);
      return 0;
    });
    total += count;
  }

  return NextResponse.json({ ok: true, flagsCreated: total });
}

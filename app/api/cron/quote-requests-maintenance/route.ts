// app/api/cron/quote-requests-maintenance/route.ts
//
// Two housekeeping jobs on QuoteRequest, both idempotent so re-running is safe:
//
//   1. Auto-expire — any QuoteRequest still 'pending' after 14 days flips to
//      'expired'. Prevents the CC inbox filling with stale rows.
//
//   2. Retention anonymise — 12 months after a terminal status (won/lost/
//      expired) the PII columns (clientName/Email/Phone) get wiped and
//      anonymisedAt gets stamped. Aggregate columns (postcode, kind, fees)
//      stay intact for analytics.
//
// Runs nightly. Auth via Bearer ${CRON_SECRET}.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AUTO_EXPIRE_DAYS = 14;
const RETENTION_MONTHS = 12;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const expiryCutoff = new Date(now);
  expiryCutoff.setDate(expiryCutoff.getDate() - AUTO_EXPIRE_DAYS);

  const retentionCutoff = new Date(now);
  retentionCutoff.setMonth(retentionCutoff.getMonth() - RETENTION_MONTHS);

  // 1. Auto-expire stale pending rows.
  const expiredResult = await prisma.quoteRequest.updateMany({
    where: {
      status: "pending",
      submittedAt: { lt: expiryCutoff },
    },
    data: {
      status: "expired",
      statusChangedAt: now,
      statusReason: `Auto-expired after ${AUTO_EXPIRE_DAYS} days without a status update.`,
    },
  });

  // 2. Anonymise PII on terminal rows past retention.
  const anonymisedResult = await prisma.quoteRequest.updateMany({
    where: {
      status: { in: ["won", "lost", "expired"] },
      statusChangedAt: { lt: retentionCutoff },
      anonymisedAt: null,
    },
    data: {
      clientName: "[anonymised]",
      clientEmail: "anonymised@removed.invalid",
      clientPhone: null,
      notes: null,
      anonymisedAt: now,
    },
  });

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    autoExpired: expiredResult.count,
    anonymised: anonymisedResult.count,
    autoExpireCutoff: expiryCutoff.toISOString(),
    retentionCutoff: retentionCutoff.toISOString(),
  });
}

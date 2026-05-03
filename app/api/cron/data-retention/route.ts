import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GDPR data retention sweep — runs weekly (Sunday 01:00 UTC via vercel.json).
 *
 * Policy:
 *   User records: anonymise non-superadmin users inactive for 3+ years who
 *   have no active/on_hold transactions. "Inactive" = updatedAt older than
 *   3 years AND no current NextAuth Session records.
 *
 *   Already-anonymised users (email ends in @deleted.invalid) are skipped.
 *
 * Dry-run mode: add ?dryRun=true to return eligible users without writing anything.
 *
 * Hard deletes are NOT performed automatically — use /api/gdpr/delete with
 * hardDelete+confirm flags for deliberate individual removal.
 */
export const dynamic = "force-dynamic";

const USER_RETENTION_YEARS = 3;
const ANONYMISED_SUFFIX = "@deleted.invalid";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - USER_RETENTION_YEARS);

  // Find candidates: non-superadmin, not already anonymised, last updated before cutoff
  const candidates = await prisma.user.findMany({
    where: {
      role: { not: "superadmin" },
      updatedAt: { lt: cutoff },
      email: { not: { endsWith: ANONYMISED_SUFFIX } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      agencyId: true,
      updatedAt: true,
      sessions: { select: { id: true }, take: 1 },
      assignedTransactions: {
        where: { status: { in: ["active", "on_hold"] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const eligible = candidates.filter(
    (u) => u.sessions.length === 0 && u.assignedTransactions.length === 0
  );

  const skippedCount = candidates.length - eligible.length;

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      cutoffDate: cutoff.toISOString(),
      candidatesFound: candidates.length,
      eligibleForAnonymisation: eligible.length,
      skipped: skippedCount,
      wouldAnonymise: eligible.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        agencyId: u.agencyId,
        updatedAt: u.updatedAt.toISOString(),
      })),
    });
  }

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, anonymised: 0, skipped: skippedCount });
  }

  let anonymised = 0;
  const errors: string[] = [];

  for (const user of eligible) {
    try {
      const anonymisedEmail = `anon-${user.id}${ANONYMISED_SUFFIX}`;
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: "Anonymised User",
            email: anonymisedEmail,
            phone: null,
            password: null,
            totpSecret: null,
            totpActivatedAt: null,
            retentionEmailOptOut: true,
          },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.account.deleteMany({ where: { userId: user.id } });
      });
      anonymised++;
    } catch (err) {
      errors.push(`${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    anonymised,
    skipped: skippedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}

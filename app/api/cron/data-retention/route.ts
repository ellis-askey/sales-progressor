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
      agencyId: true,
      // Check for active sessions
      sessions: { select: { id: true }, take: 1 },
      // Check for active/on_hold transactions they're assigned to
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

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, anonymised: 0, skipped: candidates.length });
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
    skipped: candidates.length - eligible.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

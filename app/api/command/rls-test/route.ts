import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withAgencyRls } from "@/lib/prisma-rls";

/**
 * GET /api/command/rls-test?agencyId=X&probe=Y
 *
 * Superadmin-only endpoint used during staging RLS walk-through.
 * Tests that the withAgencyRls wrapper enforces agency isolation at the
 * DB level when strict policies are active.
 *
 * Query params:
 *   agencyId  — the agency ID to set in the RLS context
 *   probe     — an agency ID to count transactions for (may differ from agencyId)
 *
 * Returns:
 *   { contextAgency, probeAgency, countWithContext, countWithoutContext }
 *
 * Expected results:
 *   Bypass policies active (staging):  countWithContext == countWithoutContext
 *   Strict policies active (prod):     countWithContext == 0 when probe != agencyId
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const agencyId = searchParams.get("agencyId");
  const probe    = searchParams.get("probe");

  if (!agencyId || !probe) {
    return NextResponse.json(
      { error: "agencyId and probe query params required" },
      { status: 400 }
    );
  }

  // Without RLS context: unscoped count (baseline)
  const countWithoutContext = await prisma.propertyTransaction.count({
    where: { agencyId: probe },
  });

  // With RLS context set to agencyId: the DB will enforce the policy
  // When strict policies are active and agencyId !== probe, this returns 0
  const countWithContext = await withAgencyRls(agencyId, (tx) =>
    tx.propertyTransaction.count({ where: { agencyId: probe } })
  );

  return NextResponse.json({
    contextAgency:      agencyId,
    probeAgency:        probe,
    countWithContext,
    countWithoutContext,
    rlsEnforcing:       countWithContext < countWithoutContext,
    note: countWithContext === countWithoutContext
      ? "Bypass policies active — strict activation required to see enforcement"
      : "Strict policies active — RLS is enforcing isolation correctly",
  });
}

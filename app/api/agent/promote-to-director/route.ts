// POST /api/agent/promote-to-director
//
// Negotiator self-promotion. Surface called from the BillingNegotiatorModal.
//
// Allowed iff:
//   - Caller is authenticated
//   - Caller's role is currently "negotiator"
//   - Caller has an agencyId
//   - That agency has ZERO existing director users
//
// The zero-director check is the load-bearing safeguard: if an agency already
// has a director, self-promotion would silently elevate the negotiator
// without the existing director's knowledge — a privilege-escalation risk.
// In that case we refuse and the modal surfaces the "ask your director"
// guidance path.
//
// On success: User.role flipped to "director". Session JWT picks up the
// new role on next reload — the modal triggers window.location.href
// = "/agent/billing" so the role-aware nav re-renders and the now-
// accessible billing page loads.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "negotiator") {
    return NextResponse.json(
      { error: "Only negotiators can request self-promotion" },
      { status: 403 },
    );
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json({ error: "No agency on session" }, { status: 400 });
  }

  // Count existing directors on the agency.
  const existingDirectors = await prisma.user.count({
    where: { agencyId, role: "director" },
  });
  if (existingDirectors > 0) {
    return NextResponse.json(
      {
        error: "Your agency already has a director — ask them to grant you director access if needed.",
      },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "director" },
  });
  console.log(`[AUDIT] negotiator_self_promoted userId=${session.user.id} agencyId=${agencyId}`);

  return NextResponse.json({ ok: true, newRole: "director" });
}

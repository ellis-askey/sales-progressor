// POST /api/command/milestone-emails/reset  { code, side, tenure, purchaseType }
//
// Removes a scenario-scoped override so the step reverts to the code default
// (or the next-most-specific override) for that scope. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  const side = String(b.side ?? "");
  const tenure = String(b.tenure ?? "any");
  const purchaseType = String(b.purchaseType ?? "any");
  if (!code || !side) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Reset only the Sales Progressor default (agencyId null) — never an agency's
  // own override, which the agency-facing editor owns (Phase 1).
  await prisma.milestoneEmailOverride.deleteMany({ where: { code, side, tenure, purchaseType, agencyId: null } });
  return NextResponse.json({ ok: true });
}

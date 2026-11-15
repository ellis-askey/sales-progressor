// POST /api/command/milestone-updates/reset  { code }
//
// Drops the override for a milestone so the portal reverts to the hardcoded
// default copy. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { recordAdminActionSafe } from "@/lib/command/audit/write";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  if (!code) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const removed = await prisma.milestoneUpdateOverride.deleteMany({ where: { code } });
  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "command.milestone_update.reset",
    targetType: "milestone_update",
    targetId: code,
    afterValue: { code, removed: removed.count },
  });
  return NextResponse.json({ ok: true });
}

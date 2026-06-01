// POST /api/agent/portal-invite-skip
//
// Increments User.portalInviteSkipCount and stamps lastPortalInviteSkipAt
// when an agent clicks "I won't be using the portal" on the new-sale form.
//
// Pure telemetry — no business logic gates anything on these fields. Surfaced
// to internal staff on /command/overview as a "portal opt-out" widget.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      portalInviteSkipCount: { increment: 1 },
      lastPortalInviteSkipAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

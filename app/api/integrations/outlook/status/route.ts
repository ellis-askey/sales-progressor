// GET /api/integrations/outlook/status
//
// Reports the current user's Outlook connection state for the Settings UI.
// Returns only non-sensitive fields — never tokens.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isOutlookConfigured } from "@/lib/integrations/outlook/config";
import { getOutlookRoster } from "@/lib/integrations/outlook/roster";

export async function GET() {
  const session = await requireSession();

  const [connections, roster] = await Promise.all([
    prisma.outlookConnection.findMany({
      where: { userId: session.user.id },
      select: { id: true, email: true, displayName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    getOutlookRoster({
      agencyId: session.user.agencyId ?? null,
      internal: !session.user.agencyId,
    }),
  ]);

  return NextResponse.json({
    configured: isOutlookConfigured(),
    connections,
    roster,
  });
}

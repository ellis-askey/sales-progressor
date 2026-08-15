// GET /api/integrations/outlook/status
//
// Reports the current user's Outlook connection state for the Settings UI.
// Returns only non-sensitive fields — never tokens.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isOutlookConfigured } from "@/lib/integrations/outlook/config";

export async function GET() {
  const session = await requireSession();
  const conn = await prisma.outlookConnection.findUnique({
    where: { userId: session.user.id },
    select: { email: true, displayName: true, createdAt: true },
  });

  return NextResponse.json({
    configured: isOutlookConfigured(),
    connected: Boolean(conn),
    email: conn?.email ?? null,
    displayName: conn?.displayName ?? null,
    connectedAt: conn?.createdAt ?? null,
  });
}

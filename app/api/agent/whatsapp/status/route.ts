// Agent-facing WhatsApp connection status (Phase 3). Scoped to the caller.
// Pivot 2026-10-18: open to external progression-business members too.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMyWhatsAppStatus } from "@/lib/integrations/whatsapp/agent-connections";
import { canUseWhatsAppConnect } from "@/lib/integrations/whatsapp/connect-access";

export async function GET() {
  const session = await requireSession();
  const role = session.user.role;
  if (!(await canUseWhatsAppConnect(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = await getMyWhatsAppStatus(session.user.id);

  // Auto to-do is an agency-level setting; only a director can change it. Surface
  // its current state (and whether this user may manage it) so the connection
  // card can reveal the toggle beneath a live connection.
  const agency = session.user.agencyId
    ? await prisma.agency.findUnique({
        where: { id: session.user.agencyId },
        select: { whatsAppTasksEnabled: true },
      })
    : null;

  return NextResponse.json({
    ...status,
    tasksEnabled: agency?.whatsAppTasksEnabled ?? false,
    canManageTasks: role === "director" && !!session.user.agencyId,
    // Auto to-dos are an agency-level feature; external business members have no
    // agency (and no "director"), so the card hides the row for them entirely.
    tasksApplicable: !!session.user.agencyId,
  });
}

// Agent-facing WhatsApp connection status (Phase 3). Scoped to the caller.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMyWhatsAppStatus } from "@/lib/integrations/whatsapp/agent-connections";

export async function GET() {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "director" && role !== "negotiator") {
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
  });
}

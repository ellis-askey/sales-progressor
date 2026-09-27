// Director-facing toggle for agency auto to-do (WhatsApp tasks). Agency-level
// setting, so only a director may change it, and only for their OWN agency
// (multi-tenant safety, Law 7). Distinct from the Command Centre control, which
// is superadmin-only.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await requireSession();
  if (session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { value?: unknown };
  if (typeof body.value !== "boolean") {
    return NextResponse.json({ error: "value must be a boolean" }, { status: 400 });
  }
  await prisma.agency.update({
    where: { id: session.user.agencyId },
    data: { whatsAppTasksEnabled: body.value },
  });
  return NextResponse.json({ ok: true, tasksEnabled: body.value });
}

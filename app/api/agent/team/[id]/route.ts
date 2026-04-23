import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function requireDirector() {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { session: null, error: NextResponse.json({ error: "Director access required" }, { status: 403 }) };
  }
  return { session, error: null };
}

// PATCH /api/agent/team/[id] — update canViewAllFiles
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireDirector();
  if (error) return error;

  const { id } = await params;
  const { canViewAllFiles } = await req.json();

  // Ensure target is a negotiator in the same agency
  const target = await prisma.user.findFirst({
    where: { id, agencyId: session!.user.agencyId, role: "negotiator" },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "Negotiator not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { canViewAllFiles: Boolean(canViewAllFiles) },
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/agent/team/[id] — deactivate a negotiator (set role to viewer)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireDirector();
  if (error) return error;

  const { id } = await params;
  if (id === session!.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id, agencyId: session!.user.agencyId, role: "negotiator" },
  });
  if (!target) return NextResponse.json({ error: "Negotiator not found" }, { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { role: "viewer" },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  updateManualTask,
  deleteManualTask,
  updateManualTaskAsProgressor,
  updateInternalManualTask,
  deleteInternalManualTask,
} from "@/lib/services/manual-tasks";

function isInternalRole(role: string | undefined | null): boolean {
  return role === "sales_progressor" || role === "admin" || role === "superadmin";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Internal self-assigned tasks branch: role-gated, agencyId-agnostic.
  // Any internal staff member can edit any internal task.
  const target = await prisma.manualTask.findUnique({
    where: { id },
    select: { isInternalSelfAssigned: true },
  });
  if (target?.isInternalSelfAssigned) {
    if (!isInternalRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const task = await updateInternalManualTask(id, body);
      return NextResponse.json(task);
    } catch {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  try {
    const task = session.user.role === "sales_progressor"
      ? await updateManualTaskAsProgressor(id, session.user.id, body)
      : await updateManualTask(id, session.user.agencyId, body);
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const target = await prisma.manualTask.findUnique({
    where: { id },
    select: { isInternalSelfAssigned: true },
  });
  if (target?.isInternalSelfAssigned) {
    if (!isInternalRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      await deleteInternalManualTask(id);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  try {
    await deleteManualTask(id, session.user.agencyId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
}

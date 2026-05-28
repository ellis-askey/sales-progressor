import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listManualTasks, createManualTask } from "@/lib/services/manual-tasks";
import { toUKDateStr } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

function isInternalRole(role: string | undefined | null): boolean {
  return role === "sales_progressor" || role === "admin" || role === "superadmin";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "open" | "done" | null;

  // Internal staff have agencyId = null; the legacy listManualTasks query
  // requires an agencyId. Return empty for them on this endpoint — the
  // internal bucket is fetched via a different surface.
  if (!session.user.agencyId) return NextResponse.json([]);
  const tasks = await listManualTasks(session.user.agencyId, status ?? undefined);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { title, notes, transactionId, assignedToId, dueDate, isAgentRequest, isInternalSelfAssigned } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  if (dueDate) {
    const dStr = toUKDateStr(new Date(dueDate));
    const todayStr = toUKDateStr(new Date());
    if (dStr < todayStr) return NextResponse.json({ error: "Due date cannot be in the past" }, { status: 400 });
  }

  // Internal self-assigned to-dos: SP/admin/superadmin only. agencyId is
  // null for the unlinked case; if a transaction is linked, the task's
  // agencyId mirrors the transaction's (so existing agency-scoped reads
  // still resolve the row, though they filter by isInternalSelfAssigned=false).
  if (isInternalSelfAssigned === true) {
    if (!isInternalRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden: internal staff only" }, { status: 403 });
    }
    let resolvedAgencyId: string | null = null;
    if (transactionId) {
      const tx = await prisma.propertyTransaction.findUnique({
        where: { id: transactionId },
        select: { agencyId: true },
      });
      resolvedAgencyId = tx?.agencyId ?? null;
    }
    const task = await createManualTask({
      agencyId: resolvedAgencyId,
      createdById: session.user.id,
      title: title.trim(),
      notes,
      transactionId,
      assignedToId,
      dueDate,
      isInternalSelfAssigned: true,
    });
    return NextResponse.json(task, { status: 201 });
  }

  // Legacy agent path: requires agencyId (customer agency users).
  if (!session.user.agencyId) {
    return NextResponse.json({ error: "Cannot create agent task without an agency" }, { status: 400 });
  }

  const task = await createManualTask({
    agencyId: session.user.agencyId,
    createdById: session.user.id,
    title: title.trim(),
    notes,
    transactionId,
    assignedToId,
    dueDate,
    isAgentRequest: isAgentRequest === true,
  });

  return NextResponse.json(task, { status: 201 });
}

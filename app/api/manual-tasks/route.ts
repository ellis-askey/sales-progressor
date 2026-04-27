import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listManualTasks, createManualTask } from "@/lib/services/manual-tasks";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "open" | "done" | null;

  const tasks = await listManualTasks(session.user.agencyId, status ?? undefined);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { title, notes, transactionId, assignedToId, dueDate, isAgentRequest } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  if (dueDate) {
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return NextResponse.json({ error: "Due date cannot be in the past" }, { status: 400 });
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

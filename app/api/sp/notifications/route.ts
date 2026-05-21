import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { markAllReadForUser } from "@/lib/services/notifications";

// GET: returns the unread Notification count for the current Sales Progressor.
// Polled every 30s by SPBell.
export async function GET() {
  const session = await requireSession();
  if (session.user.role !== "sales_progressor") {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return NextResponse.json({ count });
}

// POST: marks every unread notification for the current SP as read. Called
// when the bell is clicked. Read state lives in the DB so it syncs across
// devices (unlike the localStorage-based predecessor).
export async function POST() {
  const session = await requireSession();
  if (session.user.role !== "sales_progressor") {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const marked = await markAllReadForUser(session.user.id);
  return NextResponse.json({ ok: true, marked });
}

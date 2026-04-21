// app/api/reminders/tasks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { completeChaseTask, snoozeReminderLog } from "@/lib/services/reminders";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { taskId, action, snoozeHours } = await req.json();
  if (!taskId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    if (action === "complete") {
      await completeChaseTask(taskId, session.user.agencyId);
    } else if (action === "snooze") {
      if (!snoozeHours || typeof snoozeHours !== "number") {
        return NextResponse.json({ error: "snoozeHours required" }, { status: 400 });
      }
      await snoozeReminderLog(taskId, snoozeHours, session.user.agencyId);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

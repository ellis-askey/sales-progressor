// app/api/reminders/logs/route.ts — log-level reminder actions (wakeup)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { wakeUpReminderLog } from "@/lib/services/reminders";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { logId, action } = await req.json();
  if (!logId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    if (action === "wakeup") {
      await wakeUpReminderLog(logId, session.user.agencyId);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

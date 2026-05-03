import { NextRequest, NextResponse } from "next/server";
import { runReminderEngine } from "@/lib/services/reminders";

export const maxDuration = 120;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Vercel Cron sends GET requests
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return runEngine();
}

// Keep POST for manual triggering (e.g. admin panel, testing)
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return runEngine();
}

async function runEngine() {
  try {
    const result = await runReminderEngine();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Engine error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

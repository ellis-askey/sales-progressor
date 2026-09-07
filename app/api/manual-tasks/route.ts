import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listManualTasks } from "@/lib/services/manual-tasks";

// Mutations (create/update/delete) moved to app/actions/manual-tasks.ts so the
// mutation owns its revalidation (the old route handlers refreshed nothing,
// leaving the sidebar To-Do badge stale). This endpoint keeps the read only.
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

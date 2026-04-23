import { NextRequest, NextResponse } from "next/server";
import { portalCompleteMilestone } from "@/lib/services/portal";

export async function POST(req: NextRequest) {
  const { token, milestoneDefinitionId, eventDate } = await req.json();
  if (!token || !milestoneDefinitionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const completion = await portalCompleteMilestone({ token, milestoneDefinitionId, eventDate });
    return NextResponse.json(completion, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    const status = message === "Invalid token" ? 403 : message === "Milestone not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

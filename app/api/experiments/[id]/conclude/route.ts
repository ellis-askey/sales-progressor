import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { concludeExperiment } from "@/lib/services/experiments/lifecycle";
import type { ExperimentOutcome } from "@prisma/client";

const VALID_OUTCOMES: ExperimentOutcome[] = ["win", "loss", "inconclusive", "mixed"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { outcome, conclusionNote } = body as Record<string, unknown>;

  if (!outcome || !VALID_OUTCOMES.includes(outcome as ExperimentOutcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof conclusionNote !== "string" || conclusionNote.trim().length === 0) {
    return NextResponse.json({ error: "conclusionNote is required" }, { status: 400 });
  }

  const { id } = await params;
  try {
    await concludeExperiment(id, outcome as ExperimentOutcome, conclusionNote.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Cannot") ? 409 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}

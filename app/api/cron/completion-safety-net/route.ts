// app/api/cron/completion-safety-net/route.ts
//
// Nightly backstop for completed-but-still-"active" files.
//
// When a sale completes, the file is meant to flip from status "active" to
// "completed" automatically. That flip is triggered per confirm path via
// maybeAutoCompleteTransaction (lib/services/milestones.ts). This cron is the
// belt-and-braces layer: it re-checks every still-"active" file that has a
// completion milestone recorded and flips any that satisfy the completion
// gate but were missed (e.g. a confirm path that isn't yet wired, or a future
// one). So a finished sale can never silently sit in the active list for more
// than a day, however it was confirmed.
//
// Auth: Bearer ${CRON_SECRET} (the universal cron pattern).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeAutoCompleteTransaction } from "@/lib/services/milestones";
import { runJob } from "@/lib/cron/run-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("completion-safety-net", async () => {
  // Candidate files: currently "active" AND carrying at least one confirmed
  // completion milestone (VM20 / PM27). Two plain queries — no relation-name
  // assumptions. The helper applies the real gate (BOTH sides, round-scoped)
  // and only flips when a file genuinely qualifies.
  const completionDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM20", "PM27"] } },
    select: { id: true },
  });
  const defIds = completionDefs.map((d) => d.id);

  const completions = await prisma.milestoneCompletion.findMany({
    where: { state: "complete", milestoneDefinitionId: { in: defIds } },
    select: { transactionId: true },
    distinct: ["transactionId"],
  });
  const txIds = [...new Set(completions.map((c) => c.transactionId))];

  const candidates = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds }, status: "active" },
    select: { id: true, propertyAddress: true },
  });

  const flippedIds: string[] = [];
  for (const c of candidates) {
    const didFlip = await maybeAutoCompleteTransaction(c.id);
    if (didFlip) flippedIds.push(c.id);
  }

  if (flippedIds.length > 0) {
    console.log(
      `[completion-safety-net] flipped ${flippedIds.length} completed-but-active file(s):`,
      candidates.filter((c) => flippedIds.includes(c.id)).map((c) => c.propertyAddress),
    );
  }

  return NextResponse.json({
    ok: true,
    candidatesChecked: candidates.length,
    flipped: flippedIds.length,
    flippedIds,
  });
  });
}

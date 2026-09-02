"use server";

// Persist demo guided-walkthrough state per user, so the first-run auto-start
// fires once per teammate. Called when the tour finishes or is skipped. Either
// field being set suppresses the auto-start; "Replay walkthrough" still runs it.
// See docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md §13.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function markDemoTourSeenAction(reason: "completed" | "skipped") {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.user.id },
    data:
      reason === "completed"
        ? { demoTourCompletedAt: new Date() }
        : { demoTourSkippedAt: new Date() },
  });
}

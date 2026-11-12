import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { processProductionRelease } from "@/lib/platform-updates/auto-draft";

// Phase 3: auto-draft Platform Updates from production releases (vercel.json
// cron). Reads the LIVE production commit from its own runtime env
// (VERCEL_GIT_COMMIT_SHA) — so it only ever sees successfully-deployed PRODUCTION
// code, never staging or a failed build. One release is expanded into drafts
// exactly once (ProcessedRelease dedup). FULLY ISOLATED from deployments: every
// failure is caught + logged and returns 200, so logging can never break a
// deploy or the app. Nothing it creates is ever published.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const headSha = process.env.VERCEL_GIT_COMMIT_SHA;
    // Only act on real production deployments (guards local/staging/preview).
    if (process.env.VERCEL_ENV !== "production" || !headSha) {
      return NextResponse.json({ ok: true, skipped: "not production" });
    }

    // Dedup: this exact release already handled?
    const already = await prisma.processedRelease.findUnique({ where: { sha: headSha } });
    if (already) {
      return NextResponse.json({ ok: true, skipped: "already processed", sha: headSha.slice(0, 8) });
    }

    const last = await prisma.processedRelease.findFirst({
      orderBy: { processedAt: "desc" },
      select: { sha: true },
    });
    const baseSha = last?.sha ?? null;

    let result;
    try {
      result = await processProductionRelease({ headSha, baseSha });
    } catch (e) {
      // GitHub/network failure: do NOT record, so the next run retries. Cheap
      // (no AI runs unless the fetch succeeds). Logged, never thrown.
      Sentry.captureException(e, { tags: { cron: "platform-update-drafts" } });
      return NextResponse.json({ ok: true, retrying: true });
    }

    if (result.record) {
      await prisma.processedRelease
        .create({
          data: {
            sha: headSha,
            commitsConsidered: result.considered,
            draftsCreated: result.drafts,
            note: result.note.slice(0, 500),
          },
        })
        // A race (two overlapping cron runs) can hit the unique(sha): harmless.
        .catch(() => {});
    }

    return NextResponse.json({ ok: true, sha: headSha.slice(0, 8), ...result });
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "platform-update-drafts" } });
    // Never fail the cron.
    return NextResponse.json({ ok: false, handled: true });
  }
}

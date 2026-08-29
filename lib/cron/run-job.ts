import { prisma } from "@/lib/prisma";

// Wrap a cron job's work so the System status page can show whether it ran and
// succeeded. Records a JobRun on start, stamps success + finish on completion,
// or failure + the error message if it throws (then rethrows so Vercel still
// sees the failure). Best-effort: a logging failure never masks the real result.
//
// Usage in a cron route, AFTER the auth check (so an unauthorized 401 isn't
// logged as a run):
//   return runJob("signals", async () => { ...work...; return NextResponse.json(...); });
export async function runJob<T>(jobName: string, fn: () => Promise<T>): Promise<T> {
  let jobRunId: string | null = null;
  try {
    const jr = await prisma.jobRun.create({ data: { jobName } });
    jobRunId = jr.id;
  } catch {
    // Couldn't open the log row — still run the job.
  }

  try {
    const result = await fn();
    // Some jobs catch their own error and return a 500 JSON response rather
    // than throwing. Treat any >=500 response as a failure too, so the outer
    // wrap is correct whether the handler throws or returns an error status.
    const status = (result as { status?: unknown } | null)?.status;
    const failed = typeof status === "number" && status >= 500;
    if (jobRunId) {
      await prisma.jobRun
        .update({ where: { id: jobRunId }, data: { finishedAt: new Date(), success: !failed } })
        .catch(() => {});
    }
    return result;
  } catch (err) {
    if (jobRunId) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.jobRun
        .update({ where: { id: jobRunId }, data: { finishedAt: new Date(), success: false, errorMessage: msg.slice(0, 500) } })
        .catch(() => {});
    }
    throw err;
  }
}

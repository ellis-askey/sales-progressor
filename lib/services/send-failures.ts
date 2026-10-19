// Platform-wide recent send-failure summary. Powers two founder-only surfaces:
// the daily founder brief (a deterministic footer, see lib/services/insight/
// daily-brief.ts) and the Command Centre health page (/command/health).
//
// "Genuine failure" deliberately EXCLUDES the two non-failures that also stamp
// errorAt — dead-round skips ("recipient_round_archived") and manual review-tray
// cancellations ("Cancelled by …"). Those are intentional, not something to
// alert on. This mirrors genuineErrorPred in lib/services/automated-emails-
// coverage.ts so "a failure" means the same thing everywhere. Suppressions
// (unsubscribe / paused) stamp sentAt, not errorAt, so the errorAt filter
// already excludes them.

import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";

export type SendFailure = {
  emailType: string;
  recipientEmail: string;
  reason: string;
  propertyAddress: string | null;
  owner: string | null; // progression business, else agency, else null (agent-addressed mail)
  errorAt: Date;
};

export type SendFailureSummary = {
  total: number;
  byType: Record<string, number>;
  items: SendFailure[];
};

// errorAt set, minus the intentional non-failures. Mirror of
// automated-emails-coverage.ts:genuineErrorPred.
const genuineErrorPred: Prisma.OutboundEmailQueueWhereInput = {
  NOT: {
    OR: [
      { errorMessage: { in: ["recipient_round_archived"] } },
      { errorMessage: { startsWith: "Cancelled" } },
    ],
  },
};

// Friendly labels for the client-facing email types that can fail. Falls back
// to the de-screamed enum for anything unmapped (so a new type still reads).
const EMAIL_TYPE_LABELS: Record<string, string> = {
  OUTSOURCE_INTRO: "Welcome/intro",
  CLIENT_CHASE: "Client chase",
  MILESTONE_CONFIRMATION: "Milestone update",
  EXCHANGE: "Exchange",
  COMPLETION: "Completion",
  CELEBRATION: "Celebration",
};

export function emailTypeLabel(emailType: string): string {
  return EMAIL_TYPE_LABELS[emailType] ?? emailType.toLowerCase().replace(/_/g, " ");
}

// Genuine send failures whose errorAt landed in the last `hours`. Accepts the
// Prisma client to use so the Command Centre page can pass commandDb (Law 8)
// while the cron uses the shared app client.
export async function getRecentSendFailures(
  now: Date = new Date(),
  hours = 24,
  db: PrismaClient = prisma,
): Promise<SendFailureSummary> {
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const rows = await db.outboundEmailQueue.findMany({
    where: { errorAt: { gte: since, lte: now }, ...genuineErrorPred },
    select: {
      emailType: true,
      recipientEmail: true,
      errorMessage: true,
      errorAt: true,
      recipientContact: {
        select: {
          transaction: {
            select: {
              propertyAddress: true,
              progressionBusiness: { select: { name: true } },
              agency: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { errorAt: "desc" },
    take: 200,
  });

  const items: SendFailure[] = rows.map((r) => {
    const tx = r.recipientContact?.transaction;
    return {
      emailType: r.emailType,
      recipientEmail: r.recipientEmail,
      reason: r.errorMessage ?? "unknown",
      propertyAddress: tx?.propertyAddress ?? null,
      owner: tx?.progressionBusiness?.name ?? tx?.agency?.name ?? null,
      errorAt: r.errorAt as Date,
    };
  });

  const byType: Record<string, number> = {};
  for (const it of items) byType[it.emailType] = (byType[it.emailType] ?? 0) + 1;

  return { total: items.length, byType, items };
}

// Plain-text block for the founder brief. No markdown, no em-dashes (brief
// house style + Law 21). Appended AFTER the AI-generated body so the exact
// named list is never paraphrased or dropped by the model.
const BRIEF_FAILURE_CAP = 12;

export function formatSendFailuresForBrief(summary: SendFailureSummary): string {
  if (summary.total === 0) {
    return "EMAIL DELIVERY (last 24h, automated check)\nAll client emails sent cleanly.";
  }
  const lines = [`EMAIL DELIVERY (last 24h, automated check)`, `${summary.total} client email${summary.total === 1 ? "" : "s"} failed to send:`];
  for (const it of summary.items.slice(0, BRIEF_FAILURE_CAP)) {
    const who = it.owner ? ` (${it.owner})` : "";
    const where = it.propertyAddress ?? it.recipientEmail;
    lines.push(`- ${emailTypeLabel(it.emailType)}${who}: ${where}`);
  }
  if (summary.total > BRIEF_FAILURE_CAP) {
    lines.push(`- and ${summary.total - BRIEF_FAILURE_CAP} more`);
  }
  lines.push(`These recipients did not receive that email. See /command/health.`);
  return lines.join("\n");
}

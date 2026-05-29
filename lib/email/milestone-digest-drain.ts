// Drain logic for MILESTONE_CONFIRMATION rows. Called by
// /api/cron/send-milestone-digests every 3 minutes.
//
// Behaviour per recipient group (recipientContactId):
//   • N = 1 pending row  → send the row's stored payload verbatim. This
//                          is the locked single-event copy from the
//                          FINAL email matrix; no "digest of one" routing.
//   • N >= 2 pending rows → assemble a digest via assembleMilestoneDigest
//                          and send once, then mark every row in the group
//                          as sent.
//
// Suppression: PR 2 bilateral pair-complete suppression runs at enqueue
// time (sendRichMilestoneEmails) so the drain never sees a row for a
// suppressed recipient. No re-evaluation here.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isContactEmailSuppressed } from "@/lib/email";
import { logAutomatedEmail } from "@/lib/services/portal";
import {
  assembleMilestoneDigest,
  type MilestoneDigestPayload,
} from "@/lib/email/milestone-digest";

// sourceId for MILESTONE_CONFIRMATION rows is `${transactionId}:${milestoneCode}`.
// All rows in a per-contact group share the same transactionId.
function transactionIdFromSourceId(sourceId: string): string | null {
  const idx = sourceId.indexOf(":");
  return idx > 0 ? sourceId.slice(0, idx) : null;
}

const RUN_CAP = 200; // upper bound per drain run to prevent runaway cost

export type DrainResult = {
  groupsSeen: number;
  singleSends: number;
  digestSends: number;
  suppressed: number;
  failed: number;
};

// Group an iterable of rows by recipientContactId. Rows without a
// recipientContactId (defensive — shouldn't reach the queue for this
// emailType) are skipped.
export function groupByRecipient<T extends { recipientContactId: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.recipientContactId) continue;
    const existing = out.get(r.recipientContactId);
    if (existing) existing.push(r);
    else out.set(r.recipientContactId, [r]);
  }
  return out;
}

// Pure decision function: given the rows in a recipient's group, what
// should the drain send? Either:
//   { mode: "single", row, payload } — fire payload.subject/text/html verbatim
//   { mode: "digest", rows, assembled } — fire the assembled digest
//
// Extracted from drainMilestoneDigests so the decision can be unit-tested
// without DB or SendGrid.
export type SendDecision<T> =
  | { mode: "single"; row: T; payload: MilestoneDigestPayload }
  | { mode: "digest"; rows: T[]; assembled: ReturnType<typeof assembleMilestoneDigest> };

export function decideSendForGroup<T extends { payload: unknown }>(
  rows: T[],
): SendDecision<T> {
  if (rows.length === 0) {
    throw new Error("[milestone-digest-drain] empty group passed to decideSendForGroup");
  }
  if (rows.length === 1) {
    const row = rows[0];
    const payload = row.payload as MilestoneDigestPayload;
    return { mode: "single", row, payload };
  }
  const payloads = rows.map((r) => r.payload as MilestoneDigestPayload);
  const assembled = assembleMilestoneDigest(payloads);
  return { mode: "digest", rows, assembled };
}

// ── Drain runner ────────────────────────────────────────────────────────

export async function drainMilestoneDigests(): Promise<DrainResult> {
  const now = new Date();
  const due = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      sentAt: null,
      errorAt: null,
      scheduledFor: { lte: now },
    },
    take: RUN_CAP,
    orderBy: { scheduledFor: "asc" },
  });

  const grouped = groupByRecipient(due);

  let singleSends = 0;
  let digestSends = 0;
  let suppressed = 0;
  let failed = 0;

  for (const [contactId, rows] of grouped) {
    // Suppression check (e.g. recipient hit Unsubscribe). Mark every
    // row in the group as sentAt + errorMessage="suppressed:unsubscribed"
    // so the digest semantics never produce a half-sent group.
    let isSuppressed = false;
    try {
      isSuppressed = await isContactEmailSuppressed(contactId);
    } catch {
      // Defensive: treat suppression-check failure as not suppressed
      // (better to send than to silently drop).
      isSuppressed = false;
    }
    if (isSuppressed) {
      await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { sentAt: now, errorMessage: "suppressed:unsubscribed" },
      });
      suppressed += rows.length;
      continue;
    }

    let decision: SendDecision<typeof rows[number]>;
    try {
      decision = decideSendForGroup(rows);
    } catch (err) {
      // Assembler threw (e.g. unknown milestone code). Mark group as
      // errored — don't crash the whole drain.
      const message = err instanceof Error ? err.message : "decide error";
      await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { errorAt: now, errorMessage: message },
      });
      failed += rows.length;
      continue;
    }

    const recipientEmail = rows[0].recipientEmail;

    try {
      if (decision.mode === "single") {
        await sendEmail({
          to: recipientEmail,
          subject: decision.payload.subject,
          text: decision.payload.text,
          html: decision.payload.html,
        });
        await prisma.outboundEmailQueue.update({
          where: { id: decision.row.id },
          data: { sentAt: now },
        });
        // Write the comms-log entry now that the email has actually been
        // handed to SendGrid. The activity feed shows the real body that
        // the recipient received (single-event matrix copy).
        const txId = transactionIdFromSourceId(decision.row.sourceId);
        if (txId) {
          await logAutomatedEmail(
            txId,
            [contactId],
            decision.payload.subject,
            decision.payload.text,
          ).catch(() => {});
        }
        singleSends++;
      } else {
        await sendEmail({
          to: recipientEmail,
          subject: decision.assembled.subject,
          text: decision.assembled.text,
          html: decision.assembled.html,
        });
        await prisma.outboundEmailQueue.updateMany({
          where: { id: { in: decision.rows.map((r) => r.id) } },
          data: { sentAt: now },
        });
        // Activity feed gets the digest body — one row per recipient
        // contact, matching exactly what landed in their inbox.
        const txId = transactionIdFromSourceId(decision.rows[0].sourceId);
        if (txId) {
          await logAutomatedEmail(
            txId,
            [contactId],
            decision.assembled.subject,
            decision.assembled.text,
          ).catch(() => {});
        }
        digestSends++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "send error";
      await prisma.outboundEmailQueue.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { errorAt: now, errorMessage: message },
      });
      failed += rows.length;
    }
  }

  return {
    groupsSeen: grouped.size,
    singleSends,
    digestSends,
    suppressed,
    failed,
  };
}

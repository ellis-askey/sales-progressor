"use server";

// Server actions for the "Review before send" queue tray + modal on
// the property file page (2026-08-09).
//
// Flow:
//   Agent confirms milestones on the Steps tab. Client emails queue in
//   OutboundEmailQueue with scheduledFor = now + delay (5 min for most
//   codes, 60s for exchange/completion). The file-page tray polls
//   getPendingConfirmQueueForFile() and shows a "N updates queued"
//   pill with a live countdown. Agent can:
//     - Open the review modal (edit body via existing updateEmailPayload)
//     - Flush the batch (sendNow) — assembles a digest if N>=2 per
//       recipient, then dispatches
//     - Cancel the batch (silent) — deletes the queued rows so nothing
//       sends. Milestone confirmations stay committed.
//
// Every mutation logs an internal_note on the transaction's comms feed
// so the timeline records the agent's intervention.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { drainMilestoneDigestsForFile } from "@/lib/email/milestone-digest-drain";
import type { UserRole } from "@prisma/client";

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : T))
  | { ok: false; error: string };

// ── Auth helper: caller can review this file's queue if they can view
// the file. Mirrors the confirm-milestone permission model. Returns the
// transaction (with agencyId + agentUserId + assignedUserId) or null.
async function requireFileViewer(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      agencyId: true,
      agentUserId: true,
      assignedUserId: true,
    },
  });
  if (!tx) return null;
  return { session, tx };
}

// ─── Read: what's pending in the queue for this file ────────────────
export type PendingQueueItem = {
  id: string;
  recipientContactId: string;
  recipientName: string | null;
  recipientRole: string | null;
  recipientEmail: string;
  milestoneCode: string;
  subject: string;
  bodyText: string;
  scheduledFor: string;       // ISO string
  editedAt: string | null;
  isExchangeCompletion: boolean;
};

const EXCHANGE_COMPLETION_CODES = new Set(["VM19", "PM26", "VM20", "PM27"]);

export async function getPendingConfirmQueueForFile(
  transactionId: string,
): Promise<{ ok: true; items: PendingQueueItem[] } | { ok: false; error: string }> {
  const auth = await requireFileViewer(transactionId);
  if (!auth) return { ok: false, error: "Not found" };

  const rows = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      sentAt: null,
      errorAt: null,
      recipientContact: { propertyTransactionId: transactionId },
    },
    select: {
      id: true,
      recipientContactId: true,
      recipientEmail: true,
      payload: true,
      scheduledFor: true,
      editedAt: true,
      sourceId: true,
      recipientContact: {
        select: { name: true, roleType: true },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  const items: PendingQueueItem[] = rows
    .filter((r) => r.recipientContactId !== null)
    .map((r) => {
      const p = (r.payload ?? {}) as {
        subject?: string;
        text?: string;
        milestoneCode?: string;
      };
      const milestoneCode = p.milestoneCode ?? (r.sourceId?.split(":")[1] ?? "");
      return {
        id: r.id,
        recipientContactId: r.recipientContactId as string,
        recipientName: r.recipientContact?.name ?? null,
        recipientRole: r.recipientContact?.roleType ?? null,
        recipientEmail: r.recipientEmail,
        milestoneCode,
        subject: p.subject ?? "",
        bodyText: p.text ?? "",
        scheduledFor: r.scheduledFor.toISOString(),
        editedAt: r.editedAt?.toISOString() ?? null,
        isExchangeCompletion: EXCHANGE_COMPLETION_CODES.has(milestoneCode),
      };
    });

  return { ok: true, items };
}

// ─── Cancel: silently drop queued emails ────────────────────────────
// Confirms stay in place (they're a data point about the file); only
// the pending outbound emails go away. Best used when the agent
// realises the timing would confuse the client and would rather
// mention it themselves later.
export async function cancelPendingConfirmEmails(input: {
  transactionId: string;
  /** When provided, cancel just these rows; otherwise cancel ALL pending
   *  MILESTONE_CONFIRMATION rows on the file. */
  emailIds?: string[];
}): Promise<ActionResult<{ cancelled: number }>> {
  const auth = await requireFileViewer(input.transactionId);
  if (!auth) return { ok: false, error: "Not found" };
  const { session, tx } = auth;

  const scopeGate: Record<string, unknown> = {
    emailType: "MILESTONE_CONFIRMATION",
    sentAt: null,
    errorAt: null,
    recipientContact: { propertyTransactionId: tx.id },
  };
  if (input.emailIds && input.emailIds.length > 0) {
    scopeGate.id = { in: input.emailIds };
  }

  // Fetch first so we can name the milestones in the audit note.
  const rows = await prisma.outboundEmailQueue.findMany({
    where: scopeGate,
    select: { id: true, sourceId: true, recipientContact: { select: { name: true } } },
  });
  if (rows.length === 0) return { ok: true, cancelled: 0 };

  // Stamp errorAt with a "cancelled by agent" reason. The drain skips
  // any row with errorAt set, so this quietly removes them from send.
  await prisma.outboundEmailQueue.updateMany({
    where: scopeGate,
    data: {
      errorAt: new Date(),
      errorMessage: `Cancelled by ${session.user.name ?? "agent"} via review tray`,
    },
  });

  // One internal_note per unique milestone code, listing the recipients
  // it would have gone to. Keeps the comms feed honest without spam.
  const codeToRecipients = new Map<string, string[]>();
  for (const r of rows) {
    const code = r.sourceId?.split(":")[1] ?? "unknown";
    const list = codeToRecipients.get(code) ?? [];
    if (r.recipientContact?.name) list.push(r.recipientContact.name);
    codeToRecipients.set(code, list);
  }
  const noteParts: string[] = [];
  for (const [code, recipients] of codeToRecipients) {
    noteParts.push(`${code} → ${recipients.join(" + ") || "(no name)"}`);
  }
  await prisma.outboundMessage.create({
    data: {
      transactionId: tx.id,
      type: "internal_note",
      contactIds: [],
      content: `${session.user.name ?? "Agent"} cancelled queued client update emails: ${noteParts.join("; ")}. Milestones remain confirmed on the file.`,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/agent/transactions/${tx.id}`, "page");
  return { ok: true, cancelled: rows.length };
}

// ─── Send now: flush every pending row for this file immediately ────
// Delegates to the standard drain routine so digest-assembly behaves
// identically to the cron-triggered path.
export async function sendPendingConfirmEmailsNow(input: {
  transactionId: string;
}): Promise<ActionResult<{ sent: number }>> {
  const auth = await requireFileViewer(input.transactionId);
  if (!auth) return { ok: false, error: "Not found" };
  const { session, tx } = auth;

  const sent = await drainMilestoneDigestsForFile(tx.id);
  if (sent === 0) return { ok: true, sent: 0 };

  await prisma.outboundMessage.create({
    data: {
      transactionId: tx.id,
      type: "internal_note",
      contactIds: [],
      content: `${session.user.name ?? "Agent"} sent queued client update emails now (skipping the 5-min countdown).`,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/agent/transactions/${tx.id}`, "page");
  return { ok: true, sent };
}

// Placeholder — kept exported so an ESLint gate later can enforce
// "any consumer of the review tray also imports this to check the role
// tier". No behaviour change today. If a future rollout wants to
// restrict tray access to directors + admins, this is where the gate
// lives.
export async function _canUseReviewTray(role: UserRole): Promise<boolean> {
  // Currently: everyone who can view the file can review its queue.
  return role !== null;
}
void hasAdminPowers;  // reserved for the tighter gate above

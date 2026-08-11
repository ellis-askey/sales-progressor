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
//     - Open the review modal. Recipients with ONE pending row preview
//       + edit the single email (updateEmailPayload). Recipients with
//       2+ rows preview the MERGED digest (the email that actually
//       sends), can remove individual updates from it, or edit the
//       whole merged body (updateDigestForRecipient).
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
import {
  assembleMilestoneDigest,
  collapseBilateralPairs,
  type MilestoneDigestPayload,
} from "@/lib/email/milestone-digest";
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

// The merged-email preview for a recipient with 2+ pending rows. This is
// what the drain will ACTUALLY send (one digest email), assembled with the
// same function the drain uses so preview and send can't drift. Each
// bullet carries the queue-row ids it represents — a collapsed bilateral
// pair's bullet carries both rows, so removing that bullet removes both.
export type RecipientDigest = {
  recipientContactId: string;
  subject: string;
  bodyText: string;          // full plain-text body as it will send
  overridden: boolean;       // agent has edited the merged email
  editedAt: string | null;   // ISO, latest edit across the group
  sections: Array<{
    heading: string;
    bullets: Array<{ line: string; emailIds: string[] }>;
  }>;
};

export async function getPendingConfirmQueueForFile(
  transactionId: string,
): Promise<{ ok: true; items: PendingQueueItem[]; digests: RecipientDigest[] } | { ok: false; error: string }> {
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

  // Merged-email previews for recipients with 2+ pending rows. Assembly
  // failure (e.g. a malformed payload) just omits that recipient's digest;
  // the modal then falls back to the per-row cards rather than erroring.
  const digests: RecipientDigest[] = [];
  const byRecipient = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.recipientContactId) continue;
    const list = byRecipient.get(r.recipientContactId) ?? [];
    list.push(r);
    byRecipient.set(r.recipientContactId, list);
  }
  for (const [contactId, group] of byRecipient) {
    if (group.length < 2) continue;
    try {
      const payloads = group.map((g) => g.payload as unknown as MilestoneDigestPayload);
      const assembled = assembleMilestoneDigest(payloads);

      // Map each rendered bullet back to its queue rows.
      const idsByCode = new Map<string, string[]>();
      group.forEach((g, i) => {
        const code = payloads[i].milestoneCode;
        const list = idsByCode.get(code) ?? [];
        list.push(g.id);
        idsByCode.set(code, list);
      });
      const collapsed = collapseBilateralPairs(
        payloads.map((p) => p.milestoneCode),
        payloads[0].recipientSide,
      );
      const emailIdsForCode = new Map<string, string[]>();
      for (const item of collapsed) {
        emailIdsForCode.set(item.milestoneCode, [
          ...(idsByCode.get(item.milestoneCode) ?? []),
          ...item.absorbedCodes.flatMap((c) => idsByCode.get(c) ?? []),
        ]);
      }
      const toSection = (section: { heading: string; items: Array<{ milestoneCode: string; line: string }> }) => ({
        heading: section.heading,
        bullets: section.items.map((it) => ({
          line: it.line,
          emailIds: emailIdsForCode.get(it.milestoneCode) ?? [],
        })),
      });

      const override = payloads.map((p) => p.digestOverride).find(Boolean) ?? null;
      const latestEdit = group.reduce<Date | null>(
        (acc, g) => (g.editedAt && (!acc || g.editedAt > acc) ? g.editedAt : acc),
        null,
      );
      digests.push({
        recipientContactId: contactId,
        subject: override?.subject ?? assembled.subject,
        bodyText: override?.text ?? assembled.text,
        overridden: override !== null,
        editedAt: latestEdit ? latestEdit.toISOString() : null,
        sections: [toSection(assembled.acted), toSection(assembled.counterpart)]
          .filter((s) => s.bullets.length > 0),
      });
    } catch {
      // No digest preview for this recipient; modal falls back to rows.
    }
  }

  return { ok: true, items, digests };
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
    select: { id: true, sourceId: true, recipientContactId: true, recipientContact: { select: { name: true } } },
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

  // If specific rows were removed (per-bullet remove in the modal), clear
  // any edited-digest override on the surviving rows of the affected
  // recipients — the edited body may still mention the removed update, so
  // the survivors revert to the auto-assembled digest.
  if (input.emailIds && input.emailIds.length > 0) {
    const affected = [...new Set(rows.map((r) => r.recipientContactId).filter((v): v is string => v !== null))];
    if (affected.length > 0) {
      const survivors = await prisma.outboundEmailQueue.findMany({
        where: {
          emailType: "MILESTONE_CONFIRMATION",
          sentAt: null,
          errorAt: null,
          recipientContactId: { in: affected },
          recipientContact: { propertyTransactionId: tx.id },
        },
        select: { id: true, payload: true },
      });
      for (const s of survivors) {
        const p = (s.payload ?? {}) as Record<string, unknown>;
        if (p.digestOverride !== undefined) {
          delete p.digestOverride;
          await prisma.outboundEmailQueue.update({
            where: { id: s.id },
            data: { payload: p as object },
          });
        }
      }
    }
  }

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

// ─── Edit the merged email for one recipient ────────────────────────
// A recipient with 2+ pending rows receives ONE digest email. This
// stamps the agent's edited subject + body onto every pending row in
// the group (payload.digestOverride); the drain then sends the edited
// version verbatim instead of re-assembling. Removing a bullet later
// clears the override (see cancelPendingConfirmEmails).
export async function updateDigestForRecipient(input: {
  transactionId: string;
  recipientContactId: string;
  subject: string;
  bodyText: string;
}): Promise<ActionResult<{ updated: number }>> {
  const auth = await requireFileViewer(input.transactionId);
  if (!auth) return { ok: false, error: "Not found" };
  const { session, tx } = auth;

  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();
  if (!subject || !bodyText) {
    return { ok: false, error: "Subject and body can't be empty." };
  }

  const rows = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      sentAt: null,
      errorAt: null,
      recipientContactId: input.recipientContactId,
      recipientContact: { propertyTransactionId: tx.id },
    },
    select: { id: true, payload: true },
  });
  if (rows.length < 2) {
    // One (or zero) rows left — that's a single email now; the modal
    // edits it through updateEmailPayload instead.
    return { ok: false, error: "This recipient no longer has a combined email. Reopen the review window and edit the single email." };
  }

  const now = new Date();
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    await prisma.outboundEmailQueue.update({
      where: { id: r.id },
      data: {
        payload: { ...p, digestOverride: { subject, text: bodyText } },
        editedAt: now,
        editedById: session.user.id,
      },
    });
  }

  revalidatePath(`/agent/transactions/${tx.id}`, "page");
  return { ok: true, updated: rows.length };
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

"use server";

// Server actions for the automation-controls feature.
//
// Per-file actions (any agent on the file):
//   pauseClientEmails   — set clientEmailsPaused=true + audit columns
//   resumeClientEmails  — set clientEmailsPaused=false (audit columns stay)
//   putFileOnHold       — status: active → on_hold
//   reactivateFile      — status: on_hold → active, bump active CCS clocks
//
// Per-agency actions (director only):
//   updateAgencyChasePolicy — chaseEmailsEnabled + per-rule grace/repeat
//
// Multi-tenant safety: every transaction action uses scopeOwnershipWhere to
// verify the file belongs to the caller's scope before mutating. The agency
// action uses session.user.agencyId + a role gate.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

// ─── Per-file actions ───────────────────────────────────────────────────

export async function pauseClientEmails(transactionId: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true, serviceType: true } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.serviceType !== "self_managed") return { ok: false, error: "Automation controls only apply to self-managed files." };

  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: {
      clientEmailsPaused: true,
      pausedAt: new Date(),
      pausedById: session.user.id,
    },
  });

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

export async function resumeClientEmails(transactionId: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true } });
  if (!tx) return { ok: false, error: "Not found" };

  // Leave pausedAt + pausedById in place — they're the audit trail of the
  // last pause event, not the current state. clientEmailsPaused=false alone
  // resumes the chase pass on the next cron run.
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { clientEmailsPaused: false },
  });

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

export async function putFileOnHold(
  transactionId: string,
  // Planned return date (UI: "Come back to this on") — null/undefined means
  // "indefinitely" (no auto-surface in the hub's expired-holds widget).
  plannedEndAt?: Date | string | null,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.status === "on_hold") return { ok: true }; // already on hold; idempotent
  if (tx.status !== "active") return { ok: false, error: "Only active files can be put on hold." };

  // Normalise the planned date arg — accept string or Date, coerce or null.
  const plannedEndAtDate: Date | null = plannedEndAt
    ? (plannedEndAt instanceof Date ? plannedEndAt : new Date(plannedEndAt))
    : null;

  // Reject past dates outright — a past plannedEndAt would surface the
  // file in the hub's expired-holds widget immediately (or never resolve
  // cleanly) and silently lose the file in the user's mental model.
  // Client validates too; this is the defence-in-depth guard.
  if (plannedEndAtDate && plannedEndAtDate.getTime() <= Date.now()) {
    return { ok: false, error: "Return date must be in the future." };
  }

  // Status flip + open a new hold period in one transaction so the period
  // row exists from the moment the status changes. The hold-duration
  // helpers rely on the open period being present while status=on_hold.
  const now = new Date();
  await prisma.$transaction([
    prisma.propertyTransaction.update({
      where: { id: tx.id },
      data: { status: "on_hold" },
    }),
    prisma.transactionHoldPeriod.create({
      data: {
        transactionId: tx.id,
        startedAt: now,
        startedById: session.user.id,
        plannedEndAt: plannedEndAtDate,
      },
    }),
  ]);

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath(`/agent/hub`);
  return { ok: true };
}

// Update the OPEN hold period's plannedEndAt. Used by the hub's expired-
// holds card when the agent chooses "Extend hold" instead of "Take off hold".
// Pass null for "indefinitely".
export async function extendHoldAction(
  transactionId: string,
  plannedEndAt: Date | string | null,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.status !== "on_hold") return { ok: false, error: "File is not on hold." };

  const newDate: Date | null = plannedEndAt
    ? (plannedEndAt instanceof Date ? plannedEndAt : new Date(plannedEndAt))
    : null;

  // Same defence-in-depth as putFileOnHold — a past plannedEndAt would
  // re-trip the hub's expired-holds widget the moment it lands.
  if (newDate && newDate.getTime() <= Date.now()) {
    return { ok: false, error: "Return date must be in the future." };
  }

  // Update the currently-open period (endedAt is null). updateMany handles
  // the defensive case where multiple open periods exist (shouldn't happen).
  await prisma.transactionHoldPeriod.updateMany({
    where: { transactionId: tx.id, endedAt: null },
    data: { plannedEndAt: newDate },
  });

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath(`/agent/hub`);
  return { ok: true };
}

export async function reactivateFile(transactionId: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.status !== "on_hold") return { ok: false, error: "File is not on hold." };

  // Selective clock reset (locked decision):
  //   - Active CCS rows (mid-chase) get lastChasedAt + lastEngagedAt bumped to
  //     now, so unpausing doesn't trigger a pile-up of overdue repeat chases
  //   - Background milestones (no CCS row) are left alone — the cron's
  //     past-due normalisation handles them on the next run as a single
  //     catch-up chase, not a pile
  //   - Nothing else touched (no MilestoneCompletion edits, no rule changes)
  //   - Open hold period (endedAt is null) gets closed in the same
  //     transaction. updateMany handles the defensive case where multiple
  //     open periods somehow exist (shouldn't happen but doesn't hurt).
  const now = new Date();
  await prisma.$transaction([
    prisma.clientChaseState.updateMany({
      where: { transactionId: tx.id, status: "active" },
      data: { lastChasedAt: now, lastEngagedAt: now },
    }),
    prisma.transactionHoldPeriod.updateMany({
      where: { transactionId: tx.id, endedAt: null },
      data: { endedAt: now, endedById: session.user.id },
    }),
    prisma.propertyTransaction.update({
      where: { id: tx.id },
      data: { status: "active" },
    }),
  ]);

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

// ─── Per-agency action (director only) ──────────────────────────────────

export type ChasePolicyRuleInput = {
  milestoneCode: string;
  graceDays: number;
  repeatEveryDays: number;
};

export type UpdateAgencyChasePolicyInput = {
  chaseEmailsEnabled: boolean;
  rules: ChasePolicyRuleInput[];
};

export async function updateAgencyChasePolicy(
  input: UpdateAgencyChasePolicyInput,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };

  // Server-side guardrails — mirror the input-level min values:
  //   graceDays floor = 1 (matches CLIENT_CHASE_GRACE_FLOOR_DAYS)
  //   repeatEveryDays floor = 2 (anti-spam)
  for (const r of input.rules) {
    if (!Number.isInteger(r.graceDays) || r.graceDays < 1) {
      return { ok: false, error: `Grace days must be at least 1 (got ${r.graceDays} for ${r.milestoneCode}).` };
    }
    if (!Number.isInteger(r.repeatEveryDays) || r.repeatEveryDays < 2) {
      return { ok: false, error: `Repeat days must be at least 2 (got ${r.repeatEveryDays} for ${r.milestoneCode}).` };
    }
  }

  // Single transaction so the master toggle + rule edits land together.
  await prisma.$transaction(async (txc) => {
    await txc.agency.update({
      where: { id: agencyId },
      data: { chaseEmailsEnabled: input.chaseEmailsEnabled },
    });
    for (const r of input.rules) {
      // ReminderRule is currently global (not per-agency) — see plan
      // decision 2. Update by targetMilestoneCode. Multiple rules per code
      // is rare; we update all matching to keep behaviour consistent.
      await txc.reminderRule.updateMany({
        where: { isActive: true, targetMilestoneCode: r.milestoneCode },
        data: {
          graceDays: r.graceDays,
          repeatEveryDays: r.repeatEveryDays,
        },
      });
    }
  });

  revalidatePath("/agent/settings/automation");
  return { ok: true };
}

// ─── Email preview / edit ───────────────────────────────────────────────

export type UpdateEmailPayloadInput = {
  subject: string;
  text: string;
};

// Edits the queued email's subject + body text. Used by EmailPreviewModal.
// HTML stays as originally generated by the digest builder (template is
// heavily structured around milestone lists — agent-typed prose can't
// safely replace it). Most email clients prefer text/plain when both are
// present, so the agent's edited text is what most recipients actually
// read. HTML recipients see the original styled version. Acceptable.
//
// Gates:
//   - Email must be CLIENT_CHASE (only chases have editorial value;
//     notifications/celebrations are factual templates).
//   - Email must be pending (sentAt + errorAt both null).
//   - Caller must be a director in the agency OR the file's agentUserId.
//     sales_progressor / admin / unrelated negotiators get 403.
export async function updateEmailPayload(
  emailId: string,
  patch: UpdateEmailPayloadInput,
): Promise<ActionResult> {
  const session = await requireSession();

  if (!patch.subject?.trim() || !patch.text?.trim()) {
    return { ok: false, error: "Subject and body can't be empty." };
  }

  const email = await prisma.outboundEmailQueue.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      emailType: true,
      sentAt: true,
      errorAt: true,
      payload: true,
      recipientContact: {
        select: {
          propertyTransactionId: true,
          transaction: { select: { agencyId: true, agentUserId: true, assignedUserId: true } },
        },
      },
    },
  });

  if (!email) return { ok: false, error: "Email not found." };
  if (email.emailType !== "CLIENT_CHASE") {
    return { ok: false, error: "Only chase emails can be edited." };
  }
  if (email.sentAt || email.errorAt) {
    return { ok: false, error: "This email has already been sent and can't be edited." };
  }

  const tx = email.recipientContact?.transaction;
  if (!tx) return { ok: false, error: "Email's transaction not found." };

  // Permission gate: anyone who can VIEW this email can also edit it
  // (mirrors the inScope rule in getEmailForPreview). Effectively:
  //   admin / superadmin  → any file platform-wide
  //   sales_progressor    → their assigned outsourced files
  //   director            → any file in their agency
  //   negotiator / viewer → files where they're the assigned agent
  // Plus the gates above: emailType=CLIENT_CHASE + still pending.
  const role = session.user.role;
  let inScope = false;
  if (role === "admin" || role === "superadmin") {
    inScope = true;
  } else if (role === "sales_progressor") {
    inScope = tx.assignedUserId === session.user.id;
  } else if (role === "director") {
    inScope = tx.agencyId === session.user.agencyId;
  } else if (role === "negotiator" || role === "viewer") {
    inScope = tx.agencyId === session.user.agencyId && tx.agentUserId === session.user.id;
  }
  if (!inScope) {
    return { ok: false, error: "You don't have permission to edit this email." };
  }

  // Overwrite subject + text in the payload JSON, leave html alone.
  const currentPayload = (email.payload ?? {}) as Record<string, unknown>;
  const nextPayload = {
    ...currentPayload,
    subject: patch.subject.trim(),
    text: patch.text.trim(),
  };

  await prisma.outboundEmailQueue.update({
    where: { id: email.id },
    data: {
      payload: nextPayload,
      editedAt: new Date(),
      editedById: session.user.id,
    },
  });

  revalidatePath("/agent/automated-emails");
  if (email.recipientContact?.propertyTransactionId) {
    revalidatePath(`/agent/transactions/${email.recipientContact.propertyTransactionId}`);
  }
  return { ok: true };
}

// Read a single queued email's full payload + audit metadata for the
// EmailPreviewModal. Scope-gated the same way as updateEmailPayload so
// agents can't peek at out-of-scope emails. Returns null if not found or
// out of scope.
export async function getEmailForPreview(emailId: string): Promise<{
  ok: true;
  data: {
    id: string;
    emailType: string;
    subject: string;
    text: string;
    html: string;
    recipientName: string;
    recipientEmail: string;
    recipientRole: string;
    scheduledFor: Date;
    sentAt: Date | null;
    errorAt: Date | null;
    editedAt: Date | null;
    editedByName: string | null;
    canEdit: boolean;
    transactionId: string;
  };
} | { ok: false; error: string }> {
  const session = await requireSession();

  const email = await prisma.outboundEmailQueue.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      emailType: true,
      payload: true,
      recipientEmail: true,
      scheduledFor: true,
      sentAt: true,
      errorAt: true,
      editedAt: true,
      editedBy: { select: { name: true } },
      recipientContact: {
        select: {
          name: true,
          roleType: true,
          propertyTransactionId: true,
          transaction: { select: { agencyId: true, agentUserId: true, assignedUserId: true } },
        },
      },
    },
  });

  if (!email) return { ok: false, error: "Email not found." };
  const tx = email.recipientContact?.transaction;
  if (!tx) return { ok: false, error: "Email's transaction not found." };

  // Scope check: same model as listAutomatedEmails — admin sees all,
  // sales_progressor sees their assigned files, director sees their agency,
  // negotiator sees their own files.
  const role = session.user.role;
  let inScope = false;
  if (role === "admin" || role === "superadmin") {
    inScope = true;
  } else if (role === "sales_progressor") {
    inScope = tx.assignedUserId === session.user.id;
  } else if (role === "director") {
    inScope = tx.agencyId === session.user.agencyId;
  } else if (role === "negotiator" || role === "viewer") {
    inScope = tx.agencyId === session.user.agencyId && tx.agentUserId === session.user.id;
  }
  if (!inScope) return { ok: false, error: "Not found." };

  // Editable when in-scope (anyone who can VIEW) AND the email is still
  // editable in principle (chase + pending). Mirrors updateEmailPayload.
  const canEdit =
    inScope &&
    email.emailType === "CLIENT_CHASE" &&
    email.sentAt === null &&
    email.errorAt === null;

  const payload = (email.payload ?? {}) as { subject?: string; text?: string; html?: string };

  return {
    ok: true,
    data: {
      id: email.id,
      emailType: email.emailType,
      subject: payload.subject ?? "(no subject)",
      text: payload.text ?? "",
      html: payload.html ?? "",
      recipientName: email.recipientContact?.name ?? "(unknown)",
      recipientEmail: email.recipientEmail,
      recipientRole: email.recipientContact?.roleType ?? "",
      scheduledFor: email.scheduledFor,
      sentAt: email.sentAt,
      errorAt: email.errorAt,
      editedAt: email.editedAt,
      editedByName: email.editedBy?.name ?? null,
      canEdit,
      transactionId: email.recipientContact?.propertyTransactionId ?? "",
    },
  };
}

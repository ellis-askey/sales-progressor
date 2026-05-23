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

export async function putFileOnHold(transactionId: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true } });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.status === "on_hold") return { ok: true }; // already on hold; idempotent
  if (tx.status !== "active") return { ok: false, error: "Only active files can be put on hold." };

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
      },
    }),
  ]);

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
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

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
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { renderEditedEmailHtml } from "@/lib/email/milestone-digest";
import { agencyLogoBand } from "@/lib/email/agency-logo-band";
import { renderEditedChaseEmailHtml } from "@/lib/email/client-chase-digest";

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

// ─── Per-file actions ───────────────────────────────────────────────────

export async function pauseClientEmails(transactionId: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true, status: true } });
  if (!tx) return { ok: false, error: "Not found" };

  // No serviceType gate — the resume-from-hold modal lets users pick
  // "keep emails paused" regardless of tier, and the AutomationControls
  // toggle is now surfaced on outsourced files too so they have a way to
  // flip it back. The clientEmailsPaused flag is honoured by the chase
  // cron whether or not the file is self-managed.
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

// Per-party email pause (solicitor-confirm feature). Powers the 4-toggle menu
// on the file: seller / buyer / seller's firm / buyer's firm. Each toggle is
// independent. clientEmailsPaused is kept in sync as (both client sides
// paused) so the legacy chase-cron gate + status pills keep working while the
// per-side reads roll out. See docs/active/solicitor-confirm/scope.md.
export type EmailAudience = "vendor" | "purchaser" | "vendorSolicitor" | "purchaserSolicitor";

const AUDIENCE_FIELD: Record<EmailAudience, keyof PauseFlags> = {
  vendor: "vendorEmailsPaused",
  purchaser: "purchaserEmailsPaused",
  vendorSolicitor: "vendorSolicitorEmailsPaused",
  purchaserSolicitor: "purchaserSolicitorEmailsPaused",
};

type PauseFlags = {
  vendorEmailsPaused: boolean;
  purchaserEmailsPaused: boolean;
  vendorSolicitorEmailsPaused: boolean;
  purchaserSolicitorEmailsPaused: boolean;
};

export type EmailAudienceState = {
  vendorEmailsPaused: boolean;
  purchaserEmailsPaused: boolean;
  vendorSolicitorEmailsPaused: boolean;
  purchaserSolicitorEmailsPaused: boolean;
  vendorSolicitorFirmName: string | null;
  purchaserSolicitorFirmName: string | null;
};

// Read the current per-party pause state + firm names for the 4-toggle menu.
export async function loadEmailAudience(
  transactionId: string,
): Promise<ActionResult<EmailAudienceState>> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({
    where,
    select: {
      vendorEmailsPaused: true,
      purchaserEmailsPaused: true,
      vendorSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPaused: true,
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
    },
  });
  if (!tx) return { ok: false, error: "Not found" };

  return {
    ok: true,
    data: {
      vendorEmailsPaused: tx.vendorEmailsPaused,
      purchaserEmailsPaused: tx.purchaserEmailsPaused,
      vendorSolicitorEmailsPaused: tx.vendorSolicitorEmailsPaused,
      purchaserSolicitorEmailsPaused: tx.purchaserSolicitorEmailsPaused,
      vendorSolicitorFirmName: tx.vendorSolicitorFirm?.name ?? null,
      purchaserSolicitorFirmName: tx.purchaserSolicitorFirm?.name ?? null,
    },
  };
}

export async function setEmailAudiencePaused(
  transactionId: string,
  audience: EmailAudience,
  paused: boolean,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({
    where,
    select: {
      id: true,
      vendorEmailsPaused: true,
      purchaserEmailsPaused: true,
      vendorSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPaused: true,
    },
  });
  if (!tx) return { ok: false, error: "Not found" };

  const next: PauseFlags = {
    vendorEmailsPaused: tx.vendorEmailsPaused,
    purchaserEmailsPaused: tx.purchaserEmailsPaused,
    vendorSolicitorEmailsPaused: tx.vendorSolicitorEmailsPaused,
    purchaserSolicitorEmailsPaused: tx.purchaserSolicitorEmailsPaused,
  };
  next[AUDIENCE_FIELD[audience]] = paused;

  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: {
      ...next,
      // Legacy single flag = both client sides paused.
      clientEmailsPaused: next.vendorEmailsPaused && next.purchaserEmailsPaused,
      ...(paused ? { pausedAt: new Date(), pausedById: session.user.id } : {}),
    },
  });

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

// ─── Email settings drawer (2026-08-11) ─────────────────────────────────
// One load for everything the file's email-settings drawer shows: the
// step-confirmation email switch, per-CONTACT chase pausing (each buyer /
// seller individually, Contact.emailsPausedAt), per-FIRM chase pausing
// (the existing solicitor audience flags), and the hold state.

export type EmailSettingsContact = {
  id: string;
  name: string;
  roleType: "vendor" | "purchaser";
  paused: boolean;
};

export type EmailSettingsState = {
  suppressPortalConfirmEmails: boolean;
  status: "active" | "on_hold" | "other";
  clientEmailsPaused: boolean;
  serviceType: string | null;
  contacts: EmailSettingsContact[];
  vendorSolicitor: { name: string; paused: boolean } | null;
  purchaserSolicitor: { name: string; paused: boolean } | null;
};

export async function loadEmailSettings(
  transactionId: string,
): Promise<ActionResult<EmailSettingsState>> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({
    where,
    select: {
      status: true,
      serviceType: true,
      suppressPortalConfirmEmails: true,
      clientEmailsPaused: true,
      vendorSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPaused: true,
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      activeBuyerRoundId: true,
      contacts: {
        where: {
          roleType: { in: ["vendor", "purchaser"] },
          email: { not: null },
        },
        select: {
          id: true,
          name: true,
          roleType: true,
          emailsPausedAt: true,
          buyerRoundId: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!tx) return { ok: false, error: "Not found" };

  // Archived-round buyers stay attached to the file after a relist but
  // must not appear as pausable recipients (the chase cron already
  // excludes them). Vendors are file-level and always show.
  const contacts: EmailSettingsContact[] = tx.contacts
    .filter((c) =>
      c.roleType === "vendor" ||
      c.buyerRoundId === null ||
      c.buyerRoundId === tx.activeBuyerRoundId,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      roleType: c.roleType as "vendor" | "purchaser",
      paused: c.emailsPausedAt != null,
    }));

  return {
    ok: true,
    data: {
      suppressPortalConfirmEmails: tx.suppressPortalConfirmEmails,
      status: tx.status === "active" ? "active" : tx.status === "on_hold" ? "on_hold" : "other",
      clientEmailsPaused: tx.clientEmailsPaused,
      serviceType: tx.serviceType ?? null,
      contacts,
      vendorSolicitor: tx.vendorSolicitorFirm
        ? { name: tx.vendorSolicitorFirm.name, paused: tx.vendorSolicitorEmailsPaused }
        : null,
      purchaserSolicitor: tx.purchaserSolicitorFirm
        ? { name: tx.purchaserSolicitorFirm.name, paused: tx.purchaserSolicitorEmailsPaused }
        : null,
    },
  };
}

// Pause / resume chase emails for ONE contact. The legacy whole-file
// clientEmailsPaused flag stays in sync as "every pausable client contact
// is paused" so status pills and the silenced-files list keep working.
export async function setContactEmailsPaused(
  transactionId: string,
  contactId: string,
  paused: boolean,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({
    where,
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) return { ok: false, error: "Not found" };

  // Ownership guard: the contact must belong to THIS transaction and be a
  // client-side contact (solicitor firms pause via their own flags).
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      propertyTransactionId: tx.id,
      roleType: { in: ["vendor", "purchaser"] },
    },
    select: { id: true },
  });
  if (!contact) return { ok: false, error: "Not found" };

  await prisma.contact.update({
    where: { id: contact.id },
    data: { emailsPausedAt: paused ? new Date() : null },
  });

  // Re-derive the legacy whole-file flag from the current per-contact
  // state (active-round, emailable contacts only, matching the drawer's
  // list and the cron's recipients).
  const pausable = await prisma.contact.findMany({
    where: {
      propertyTransactionId: tx.id,
      roleType: { in: ["vendor", "purchaser"] },
      email: { not: null },
    },
    select: { roleType: true, emailsPausedAt: true, buyerRoundId: true },
  });
  const relevant = pausable.filter((c) =>
    c.roleType === "vendor" ||
    c.buyerRoundId === null ||
    c.buyerRoundId === tx.activeBuyerRoundId,
  );
  const allPaused = relevant.length > 0 && relevant.every((c) => c.emailsPausedAt != null);
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: {
      clientEmailsPaused: allPaused,
      ...(paused ? { pausedAt: new Date(), pausedById: session.user.id } : {}),
    },
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
  // Optional free-text "why is this going on hold" — stored on the hold
  // period and surfaced by the hub's holds-needing-attention card.
  reason?: string | null,
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
        reason: reason?.trim() ? reason.trim().slice(0, 500) : null,
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

// Agency-level on/off for the weekly "all on track" client update. Director
// only. Off means the whole agency stops sending the weekly email; unsubscribed
// clients are excluded regardless (that's enforced at send time).
export async function setWeeklyClientUpdatesEnabled(enabled: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };
  await prisma.agency.update({
    where: { id: agencyId },
    data: { weeklyClientUpdatesEnabled: enabled },
  });
  revalidatePath("/agent/settings/automation");
  return { ok: true };
}

// Chain neighbour updates (Note A) — director-only, off by default. When on,
// a seller confirming an onward-purchase step notifies the invited onward agent
// above. Only invited (never cold) neighbours are emailed; they can unsubscribe.
export async function setChainNeighbourUpdatesEnabled(enabled: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };
  await prisma.agency.update({
    where: { id: agencyId },
    data: { chainNeighbourUpdatesEnabled: enabled },
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
  // 2026-08-09 review-tray: MILESTONE_CONFIRMATION rows are also
  // editable from the file-page review tray now. Same permission +
  // "not yet sent" gates apply. Every other emailType remains locked.
  if (email.emailType !== "CLIENT_CHASE" && email.emailType !== "MILESTONE_CONFIRMATION") {
    return { ok: false, error: "This email type can't be edited." };
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
  if (hasAdminPowers(session)) {
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

  // 2026-08-11: for milestone-confirmation rows, re-render the HTML part
  // from the edited text. Email apps display the HTML part, and leaving
  // the original html in place meant the edit shipped invisibly (new
  // subject, stale body). Older rows without address/portalUrl metadata
  // keep their original html (pre-batching rows; none should be pending).
  //
  // 2026-08-19: same treatment for CLIENT_CHASE rows. Chase edits shipped
  // the stale original html too (founder report: edited line breaks, and
  // in fact the whole edit, never reached the recipient). Rows enqueued
  // from today carry the shell ingredients (agencyName / respondUrl /
  // pauseUrl / unsubscribeUrl) so the branded chase shell rebuilds around
  // the edited body; older pending rows keep their original html.
  const currentPayload = (email.payload ?? {}) as Record<string, unknown>;
  let rebuiltHtml: string | null = null;
  if (email.emailType === "MILESTONE_CONFIRMATION") {
    const address = typeof currentPayload.address === "string" ? currentPayload.address : null;
    const portalUrl = typeof currentPayload.portalUrl === "string" ? currentPayload.portalUrl : null;
    if (address && portalUrl) {
      rebuiltHtml = renderEditedEmailHtml({
        address,
        heading: patch.subject.trim(),
        text: patch.text.trim(),
        portalUrl,
        logoBand: await agencyLogoBand(tx.agencyId),
      });
    }
  } else if (email.emailType === "CLIENT_CHASE") {
    const agencyName = typeof currentPayload.agencyName === "string" ? currentPayload.agencyName : null;
    const respondUrl = typeof currentPayload.respondUrl === "string" ? currentPayload.respondUrl : null;
    const pauseUrl = typeof currentPayload.pauseUrl === "string" ? currentPayload.pauseUrl : null;
    const unsubscribeUrl = typeof currentPayload.unsubscribeUrl === "string" ? currentPayload.unsubscribeUrl : null;
    if (agencyName && respondUrl && pauseUrl && unsubscribeUrl) {
      rebuiltHtml = renderEditedChaseEmailHtml({
        agencyName,
        subject: patch.subject.trim(),
        text: patch.text.trim(),
        respondUrl,
        pauseUrl,
        unsubscribeUrl,
      });
    }
  }

  // Overwrite subject + text (and, where rebuilt, html) in the payload JSON.
  const nextPayload = {
    ...currentPayload,
    subject: patch.subject.trim(),
    text: patch.text.trim(),
    ...(rebuiltHtml ? { html: rebuiltHtml } : {}),
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
  if (hasAdminPowers(session)) {
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

// ─── Solicitor chase cadence (global singleton) ─────────────────────────────
// The solicitor confirmation feature's on/off switch + softer cadence. Global
// (one row for the whole platform), matching how client reminder timing is
// global. Editable by a director or internal admin from Settings → Automation.
// Off until explicitly turned on. See docs/active/solicitor-confirm/scope.md.

export type SolicitorCadenceState = {
  enabled: boolean;
  graceWorkingDays: number;
  repeatDays: number;
  maxChases: number;
};

function canEditSolicitorCadence(session: Awaited<ReturnType<typeof requireSession>>): boolean {
  return session.user.role === "director" || hasAdminPowers(session);
}

export async function loadSolicitorCadence(): Promise<ActionResult<SolicitorCadenceState>> {
  const session = await requireSession();
  if (!canEditSolicitorCadence(session)) {
    return { ok: false, error: "You don't have access to automation settings." };
  }
  const row = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  return {
    ok: true,
    data: {
      // No row = off (safe default) with the standard soft cadence shown.
      enabled: row?.enabledByDefault ?? false,
      graceWorkingDays: row?.graceWorkingDays ?? 5,
      repeatDays: row?.repeatDays ?? 7,
      maxChases: row?.maxChases ?? 2,
    },
  };
}

export async function updateSolicitorCadence(input: SolicitorCadenceState): Promise<ActionResult> {
  const session = await requireSession();
  if (!canEditSolicitorCadence(session)) {
    return { ok: false, error: "You don't have access to automation settings." };
  }
  if (!Number.isInteger(input.graceWorkingDays) || input.graceWorkingDays < 1) {
    return { ok: false, error: "Grace (working days) must be at least 1." };
  }
  if (!Number.isInteger(input.repeatDays) || input.repeatDays < 2) {
    return { ok: false, error: "Repeat days must be at least 2." };
  }
  if (!Number.isInteger(input.maxChases) || input.maxChases < 1) {
    return { ok: false, error: "Number of nudges must be at least 1." };
  }

  const data = {
    enabledByDefault: input.enabled,
    graceWorkingDays: input.graceWorkingDays,
    repeatDays: input.repeatDays,
    maxChases: input.maxChases,
    updatedById: session.user.id,
  };
  await prisma.solicitorChaseSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  revalidatePath("/agent/settings/automation");
  return { ok: true };
}

// ── Per-code solicitor cadences (SolicitorReminderRule) ────────────────────
// One row per solicitor-owned milestone code. Ellis reviews all cadences
// on Settings → Automation; per-code tuning without needing a code change.

export type SolicitorRuleRow = {
  milestoneCode: string;
  graceWorkingDays: number;
  repeatWorkingDays: number;
  maxChases: number;
  active: boolean;
  anchorMilestoneCode: string | null;
  useAnchorEventDate: boolean;
};

export async function loadSolicitorRules(): Promise<ActionResult<SolicitorRuleRow[]>> {
  const session = await requireSession();
  if (!canEditSolicitorCadence(session)) {
    return { ok: false, error: "You don't have access to automation settings." };
  }
  const rows = await prisma.solicitorReminderRule.findMany({
    orderBy: { milestoneCode: "asc" },
  });
  return {
    ok: true,
    data: rows.map((r) => ({
      milestoneCode: r.milestoneCode,
      graceWorkingDays: r.graceWorkingDays,
      repeatWorkingDays: r.repeatWorkingDays,
      maxChases: r.maxChases,
      active: r.active,
      anchorMilestoneCode: r.anchorMilestoneCode,
      useAnchorEventDate: r.useAnchorEventDate,
    })),
  };
}

export async function updateSolicitorRule(input: {
  milestoneCode: string;
  graceWorkingDays: number;
  repeatWorkingDays: number;
  maxChases: number;
  active: boolean;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!canEditSolicitorCadence(session)) {
    return { ok: false, error: "You don't have access to automation settings." };
  }
  if (!input.milestoneCode) {
    return { ok: false, error: "Missing milestone code." };
  }
  if (!Number.isInteger(input.graceWorkingDays) || input.graceWorkingDays < 1) {
    return { ok: false, error: "Grace (working days) must be at least 1." };
  }
  if (!Number.isInteger(input.repeatWorkingDays) || input.repeatWorkingDays < 1) {
    return { ok: false, error: "Repeat (working days) must be at least 1." };
  }
  if (!Number.isInteger(input.maxChases) || input.maxChases < 1) {
    return { ok: false, error: "Max chases must be at least 1." };
  }
  const existing = await prisma.solicitorReminderRule.findUnique({
    where: { milestoneCode: input.milestoneCode },
  });
  if (!existing) {
    return { ok: false, error: `No rule found for ${input.milestoneCode}.` };
  }
  await prisma.solicitorReminderRule.update({
    where: { milestoneCode: input.milestoneCode },
    data: {
      graceWorkingDays: input.graceWorkingDays,
      repeatWorkingDays: input.repeatWorkingDays,
      maxChases: input.maxChases,
      active: input.active,
    },
  });
  revalidatePath("/agent/settings/automation");
  return { ok: true };
}

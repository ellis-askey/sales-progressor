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
import type { StudioTheme } from "@/lib/email/email-theme-studio";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { CLIENT_CHASE_ESCALATE_MIN, CLIENT_CHASE_ESCALATE_MAX } from "@/lib/chase/chaseable-milestones";

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
// independent, and independent of the file-wide "Automatic chasing" master
// (clientEmailsPaused) — a per-side pause never writes the master flag.
// See docs/active/solicitor-confirm/scope.md.
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
      // clientEmailsPaused is NOT derived here. It's the independent "Automatic
      // chasing" master (owned by pause/resumeClientEmails). A per-side toggle
      // must never clobber it, or pausing both client sides would silently flip
      // the whole master off underneath the agent.
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
  paused: boolean;            // chase emails paused for this person
  stepConfirmPaused: boolean; // step-confirmation emails paused for this person
};

export type EmailSettingsState = {
  suppressPortalConfirmEmails: boolean;
  // Per-file, per-side key-dates portal override: null = follow the agency
  // default, true = force show, false = force hide. `agencyShowPortalKeyDates`
  // is the agency-wide default, shown so the drawer renders the resolved state.
  portalKeyDatesOverrideVendor: boolean | null;
  portalKeyDatesOverridePurchaser: boolean | null;
  agencyShowPortalKeyDates: boolean;
  status: "active" | "on_hold" | "other";
  clientEmailsPaused: boolean;
  // Enquiry auto-chase paused for THIS file (raise nudges + reply-loop chase).
  enquiryChasePaused: boolean;
  serviceType: string | null;
  contacts: EmailSettingsContact[];
  vendorSolicitor: { name: string; paused: boolean } | null;
  purchaserSolicitor: { name: string; paused: boolean } | null;
};

// Per-person pause on STEP-CONFIRMATION emails. Independent of the chase pause
// (setContactEmailsPaused) and of the file-wide suppressPortalConfirmEmails
// master — this just flips one client contact's stepConfirmPausedAt. The portal
// milestone-confirmation send skips a contact while it's set.
export async function setContactStepConfirmPaused(
  transactionId: string,
  contactId: string,
  paused: boolean,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);

  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true } });
  if (!tx) return { ok: false, error: "Not found" };

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, propertyTransactionId: tx.id, roleType: { in: ["vendor", "purchaser"] } },
    select: { id: true },
  });
  if (!contact) return { ok: false, error: "Not found" };

  await prisma.contact.update({
    where: { id: contact.id },
    data: { stepConfirmPausedAt: paused ? new Date() : null },
  });

  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

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
      portalKeyDatesOverrideVendor: true,
      portalKeyDatesOverridePurchaser: true,
      agency: { select: { showPortalKeyDates: true } },
      clientEmailsPaused: true,
      enquiryChasePaused: true,
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
          stepConfirmPausedAt: true,
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
      stepConfirmPaused: c.stepConfirmPausedAt != null,
    }));

  return {
    ok: true,
    data: {
      suppressPortalConfirmEmails: tx.suppressPortalConfirmEmails,
      portalKeyDatesOverrideVendor: tx.portalKeyDatesOverrideVendor,
      portalKeyDatesOverridePurchaser: tx.portalKeyDatesOverridePurchaser,
      agencyShowPortalKeyDates: tx.agency?.showPortalKeyDates ?? true,
      status: tx.status === "active" ? "active" : tx.status === "on_hold" ? "on_hold" : "other",
      clientEmailsPaused: tx.clientEmailsPaused,
      enquiryChasePaused: tx.enquiryChasePaused,
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

// Pause / resume the ENQUIRIES auto-chase for this file only (raise nudges +
// reply-loop chase). Distinct from the per-solicitor pause, which silences all
// solicitor email. The chase crons filter on enquiryChasePaused=false.
export async function setEnquiryChasePaused(transactionId: string, paused: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const where = scopeOwnershipWhere(scope, transactionId);
  const tx = await prisma.propertyTransaction.findFirst({ where, select: { id: true } });
  if (!tx) return { ok: false, error: "Not found" };
  await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { enquiryChasePaused: paused } });
  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

// Pause / resume chase emails for ONE contact. Independent of the file-wide
// "Automatic chasing" master (clientEmailsPaused), which is owned solely by
// pause/resumeClientEmails — pausing one contact never touches it.
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

  // clientEmailsPaused is NOT re-derived from per-contact state. It's the
  // independent "Automatic chasing" master (owned by pause/resumeClientEmails).
  // Pausing every client individually must not flip the master off underneath,
  // and the master must not be undone by a single contact toggle. The two live
  // side by side: the master suppresses everything; the per-contact flags take
  // effect only while the master is on.

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
  // Extending/clearing a hold can change whether it counts as a due review, so
  // refresh the layout-scoped sidebar To-Do badge too.
  revalidatePath("/agent", "layout");
  return { ok: true };
}

// Edit the reason on an on-hold file's open hold period, inline from the Files
// list Paused cell. No status change — just relabels why it's paused.
export async function updateHoldReasonAction(transactionId: string, reason: string): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, status: true },
  });
  if (!tx) return { ok: false, error: "Not found" };
  if (tx.status !== "on_hold") return { ok: false, error: "File is not on hold." };
  const clean = reason.trim().slice(0, 500);
  // Update the currently-open period (endedAt null); updateMany covers the
  // defensive multiple-open case, like the other hold writes.
  await prisma.transactionHoldPeriod.updateMany({
    where: { transactionId: tx.id, endedAt: null },
    data: { reason: clean || null },
  });
  revalidatePath(`/agent/transactions/${transactionId}`);
  revalidatePath(`/agent/hub`);
  revalidatePath("/agent", "layout");
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
  // The sidebar To-Do badge counts hold reviews and is computed in the /agent
  // layout, which a page-scoped revalidate never reaches — refresh it so the
  // badge decrements the moment a file comes off hold.
  revalidatePath("/agent", "layout");
  return { ok: true };
}

// ─── Per-agency action (director only) ──────────────────────────────────

export type ChasePolicyRuleInput = {
  milestoneCode: string;
  graceDays: number;
  repeatEveryDays: number;
  // null = inherit the scope's global escalate default; a number overrides it
  // for this milestone only.
  escalateAfterChases?: number | null;
  // Per-milestone client-chase on/off (default true). false = never chase the
  // client on this step.
  enabled?: boolean;
};

export type UpdateAgencyChasePolicyInput = {
  // Optional: when omitted (undefined), the master on/off flag is left untouched.
  // Used when the cadence editor is embedded under a page that already owns the
  // client-chase toggle (the business Automation tab), so the two don't fight.
  chaseEmailsEnabled?: boolean;
  // The scope's global "hand back after N unanswered chases" default. Omitted =
  // left untouched.
  escalateAfterChases?: number;
  rules: ChasePolicyRuleInput[];
};

// Shared validation for both the agency and business chase-policy actions.
// Returns an error string, or null when the input is valid.
function validateChasePolicyInput(input: UpdateAgencyChasePolicyInput): string | null {
  if (
    input.escalateAfterChases !== undefined &&
    (!Number.isInteger(input.escalateAfterChases) ||
      input.escalateAfterChases < CLIENT_CHASE_ESCALATE_MIN ||
      input.escalateAfterChases > CLIENT_CHASE_ESCALATE_MAX)
  ) {
    return `Escalation count must be between ${CLIENT_CHASE_ESCALATE_MIN} and ${CLIENT_CHASE_ESCALATE_MAX}.`;
  }
  for (const r of input.rules) {
    if (!Number.isInteger(r.graceDays) || r.graceDays < 1) {
      return `Grace days must be at least 1 (got ${r.graceDays} for ${r.milestoneCode}).`;
    }
    if (!Number.isInteger(r.repeatEveryDays) || r.repeatEveryDays < 2) {
      return `Repeat days must be at least 2 (got ${r.repeatEveryDays} for ${r.milestoneCode}).`;
    }
    if (
      r.escalateAfterChases != null &&
      (!Number.isInteger(r.escalateAfterChases) ||
        r.escalateAfterChases < CLIENT_CHASE_ESCALATE_MIN ||
        r.escalateAfterChases > CLIENT_CHASE_ESCALATE_MAX)
    ) {
      return `Escalation count for ${r.milestoneCode} must be between ${CLIENT_CHASE_ESCALATE_MIN} and ${CLIENT_CHASE_ESCALATE_MAX}.`;
    }
  }
  return null;
}

export async function updateAgencyChasePolicy(
  input: UpdateAgencyChasePolicyInput,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };

  // Server-side guardrails (grace ≥ 1, repeat ≥ 2, escalate within bounds).
  const invalid = validateChasePolicyInput(input);
  if (invalid) return { ok: false, error: invalid };

  // Per-agency overrides (not the shared ReminderRule). ReminderRule holds the
  // single platform default; we write this agency's own timings into
  // AgencyChaseRuleOverride so they apply to THIS agency's self-managed files
  // only, never to outsourced files or any other agency. A rule back at the
  // platform default in every respect clears the override (clean reset).
  const defaults = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: input.rules.map((r) => r.milestoneCode) } },
    select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
  });
  const defaultByCode = new Map(defaults.map((d) => [d.targetMilestoneCode!, d]));

  // Single transaction so the master toggle + global default + override edits land together.
  await prisma.$transaction(async (txc) => {
    const agencyData: { chaseEmailsEnabled?: boolean; clientChaseEscalateAfter?: number } = {};
    if (input.chaseEmailsEnabled !== undefined) agencyData.chaseEmailsEnabled = input.chaseEmailsEnabled;
    if (input.escalateAfterChases !== undefined) agencyData.clientChaseEscalateAfter = input.escalateAfterChases;
    if (Object.keys(agencyData).length) {
      await txc.agency.update({ where: { id: agencyId }, data: agencyData });
    }
    for (const r of input.rules) {
      const def = defaultByCode.get(r.milestoneCode);
      const atDefaultTiming = !!def && def.graceDays === r.graceDays && def.repeatEveryDays === r.repeatEveryDays;
      // A row only persists if it differs from default in SOME way: timing,
      // a per-milestone escalate override, or being switched off.
      const isDefault = atDefaultTiming && (r.enabled ?? true) === true && r.escalateAfterChases == null;
      if (isDefault) {
        await txc.agencyChaseRuleOverride.deleteMany({ where: { agencyId, milestoneCode: r.milestoneCode } });
      } else {
        const data = {
          graceDays: r.graceDays,
          repeatEveryDays: r.repeatEveryDays,
          escalateAfterChases: r.escalateAfterChases ?? null,
          enabled: r.enabled ?? true,
        };
        await txc.agencyChaseRuleOverride.upsert({
          where: { agencyId_milestoneCode: { agencyId, milestoneCode: r.milestoneCode } },
          create: { agencyId, milestoneCode: r.milestoneCode, ...data },
          update: data,
        });
      }
    }
  });

  revalidatePath("/agent/settings/automation");
  revalidatePath("/agent/account/chasing");
  return { ok: true };
}

// Per-progression-business chase policy for the business's OUTSOURCED files
// (#228). Owner-only. Mirrors updateAgencyChasePolicy: the master toggle maps to
// ProgressionBusiness.chaseClientsEnabled, and per-milestone timings write to
// BusinessChaseRuleOverride (cleared when back at the platform default). Scoped
// to the owner's own business, so it never touches another business or TSP.
export async function updateBusinessChasePolicy(
  input: UpdateAgencyChasePolicyInput,
): Promise<ActionResult> {
  const session = await requireSession();
  const businessId = session.user.progressionBusinessId;
  if (!businessId || session.user.progressionBusinessRole !== "owner") {
    return { ok: false, error: "Only the business owner can change these settings." };
  }

  const invalid = validateChasePolicyInput(input);
  if (invalid) return { ok: false, error: invalid };

  const defaults = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: input.rules.map((r) => r.milestoneCode) } },
    select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
  });
  const defaultByCode = new Map(defaults.map((d) => [d.targetMilestoneCode!, d]));

  await prisma.$transaction(async (txc) => {
    const bizData: { chaseClientsEnabled?: boolean; clientChaseEscalateAfter?: number } = {};
    if (input.chaseEmailsEnabled !== undefined) bizData.chaseClientsEnabled = input.chaseEmailsEnabled;
    if (input.escalateAfterChases !== undefined) bizData.clientChaseEscalateAfter = input.escalateAfterChases;
    if (Object.keys(bizData).length) {
      await txc.progressionBusiness.update({ where: { id: businessId }, data: bizData });
    }
    for (const r of input.rules) {
      const def = defaultByCode.get(r.milestoneCode);
      const atDefaultTiming = !!def && def.graceDays === r.graceDays && def.repeatEveryDays === r.repeatEveryDays;
      const isDefault = atDefaultTiming && (r.enabled ?? true) === true && r.escalateAfterChases == null;
      if (isDefault) {
        await txc.businessChaseRuleOverride.deleteMany({
          where: { progressionBusinessId: businessId, milestoneCode: r.milestoneCode },
        });
      } else {
        const data = {
          graceDays: r.graceDays,
          repeatEveryDays: r.repeatEveryDays,
          escalateAfterChases: r.escalateAfterChases ?? null,
          enabled: r.enabled ?? true,
        };
        await txc.businessChaseRuleOverride.upsert({
          where: { progressionBusinessId_milestoneCode: { progressionBusinessId: businessId, milestoneCode: r.milestoneCode } },
          create: { progressionBusinessId: businessId, milestoneCode: r.milestoneCode, ...data },
          update: data,
        });
      }
    }
  });

  revalidatePath("/agent/settings/automation");
  revalidatePath("/agent/settings/chases");
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

// Director-only: turn the ENQUIRIES auto-chase on/off for the whole agency. Flips
// both streams together (the nudge-to-raise chase AND the reply-loop chase) — the
// Command Centre keeps the granular per-stream control. The platform master switch
// (SolicitorChaseSettings.enabledByDefault) still gates everything above this.
export async function setAgencyEnquiryChaseEnabled(enabled: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };
  await prisma.agency.update({
    where: { id: agencyId },
    data: { enquiryReplyChaseEnabled: enabled, enquiryRaiseChaseEnabled: enabled },
  });
  revalidatePath("/agent/account/emails");
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

// The self-managed welcome modal's 5 chase toggles, saved in one call. Director-only
// + agency-scoped. Maps the 5 toggles to the 6 Agency flags: Solicitor chases drives
// solicitorChaseEnabled (solicitor confirmations only); Enquiry chases drives BOTH
// enquiry streams (enquiryReplyChaseEnabled AND enquiryRaiseChaseEnabled).
// All six are already enforced by the live chase engines, so writing them is enough.
export async function saveAgentChasePrefsAction(prefs: {
  client: boolean; solicitor: boolean; enquiries: boolean; weekly: boolean; chain: boolean;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change automation settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };
  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      chaseEmailsEnabled: !!prefs.client,
      solicitorChaseEnabled: !!prefs.solicitor,
      enquiryRaiseChaseEnabled: !!prefs.enquiries,
      enquiryReplyChaseEnabled: !!prefs.enquiries,
      weeklyClientUpdatesEnabled: !!prefs.weekly,
      chainNeighbourUpdatesEnabled: !!prefs.chain,
    },
  });
  revalidatePath("/agent/account/chasing");
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
// Load a queued email and gate it for editing: editable type, not yet sent,
// and the caller is in scope. Shared by updateEmailPayload (persist) and
// renderEmailPreview (live, no persist) so the live preview can never render
// something the save would reject — one permission gate, not two.
//   admin / superadmin  → any file platform-wide
//   sales_progressor    → their assigned outsourced files
//   director            → any file in their agency
//   negotiator / viewer → files where they're the assigned agent
async function loadEditableEmail(
  session: Awaited<ReturnType<typeof requireSession>>,
  emailId: string,
) {
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
  if (!email) return { ok: false as const, error: "Email not found." };
  if (email.emailType !== "CLIENT_CHASE" && email.emailType !== "MILESTONE_CONFIRMATION") {
    return { ok: false as const, error: "This email type can't be edited." };
  }
  if (email.sentAt || email.errorAt) {
    return { ok: false as const, error: "This email has already been sent and can't be edited." };
  }
  const tx = email.recipientContact?.transaction;
  if (!tx) return { ok: false as const, error: "Email's transaction not found." };
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
    return { ok: false as const, error: "You don't have permission to edit this email." };
  }
  return { ok: true as const, email, tx };
}

// Rebuild the branded HTML shell around an edited subject/body — the SAME
// render the real send uses, so a preview matches what ships. Returns null for
// older rows that lack the stored shell ingredients (they keep their original
// html on save).
async function rebuildEmailHtml(
  email: { emailType: string; payload: unknown; recipientContact: { propertyTransactionId: string | null } | null },
  agencyId: string,
  subject: string,
  text: string,
): Promise<string | null> {
  const currentPayload = (email.payload ?? {}) as Record<string, unknown>;
  // Brand theme (agency colours; coral default) so the rebuilt shell matches
  // what actually sends — resolved from the file it belongs to.
  const rebuildTxId = email.recipientContact?.propertyTransactionId ?? null;
  const rebuildTheme = rebuildTxId
    ? (await resolveAgencySenderForTransaction(rebuildTxId)).theme ?? resolveEmailTheme(null)
    : resolveEmailTheme(null);
  if (email.emailType === "MILESTONE_CONFIRMATION") {
    const address = typeof currentPayload.address === "string" ? currentPayload.address : null;
    const portalUrl = typeof currentPayload.portalUrl === "string" ? currentPayload.portalUrl : null;
    if (address && portalUrl) {
      return renderEditedEmailHtml({
        address,
        heading: subject,
        text,
        portalUrl,
        logoBand: await agencyLogoBand(agencyId),
        theme: rebuildTheme,
      });
    }
  } else if (email.emailType === "CLIENT_CHASE") {
    const agencyName = typeof currentPayload.agencyName === "string" ? currentPayload.agencyName : null;
    const respondUrl = typeof currentPayload.respondUrl === "string" ? currentPayload.respondUrl : null;
    const pauseUrl = typeof currentPayload.pauseUrl === "string" ? currentPayload.pauseUrl : null;
    const unsubscribeUrl = typeof currentPayload.unsubscribeUrl === "string" ? currentPayload.unsubscribeUrl : null;
    // Studio theme ingredients stored at enqueue — present only for customised
    // agencies/businesses, so the edited chase re-renders through the studio shell.
    const pStudioTheme = (currentPayload.studioTheme && typeof currentPayload.studioTheme === "object") ? currentPayload.studioTheme as StudioTheme : undefined;
    const pIdentity = typeof currentPayload.identityName === "string" ? currentPayload.identityName : undefined;
    const pLogoUrl = typeof currentPayload.studioLogoUrl === "string" ? currentPayload.studioLogoUrl : undefined;
    const pTileColor = typeof currentPayload.studioTileColor === "string" ? currentPayload.studioTileColor : undefined;
    if (agencyName && respondUrl && pauseUrl && unsubscribeUrl) {
      return renderEditedChaseEmailHtml({
        agencyName,
        subject,
        text,
        respondUrl,
        pauseUrl,
        unsubscribeUrl,
        theme: rebuildTheme,
        studioTheme: pStudioTheme,
        identityName: pIdentity,
        logoUrl: pLogoUrl,
        tileColor: pTileColor,
      });
    }
  }
  return null;
}

// Live preview: render the branded shell around an in-progress edit WITHOUT
// persisting, so the detail drawer can show what the edited email will look
// like as the agent types. Same gate + same render path as the save.
export async function renderEmailPreview(
  emailId: string,
  patch: { subject: string; text: string },
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!patch.subject?.trim() || !patch.text?.trim()) {
    return { ok: false, error: "Subject and body can't be empty." };
  }
  const loaded = await loadEditableEmail(session, emailId);
  if (!loaded.ok) return loaded;
  const html = await rebuildEmailHtml(loaded.email, loaded.tx.agencyId, patch.subject.trim(), patch.text.trim());
  if (!html) return { ok: false, error: "This email can't be previewed live." };
  return { ok: true, html };
}

export async function updateEmailPayload(
  emailId: string,
  patch: UpdateEmailPayloadInput,
): Promise<ActionResult> {
  const session = await requireSession();

  if (!patch.subject?.trim() || !patch.text?.trim()) {
    return { ok: false, error: "Subject and body can't be empty." };
  }

  const loaded = await loadEditableEmail(session, emailId);
  if (!loaded.ok) return loaded;
  const { email, tx } = loaded;

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
  const rebuiltHtml = await rebuildEmailHtml(email, tx.agencyId, patch.subject.trim(), patch.text.trim());

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
    // The step being chased ("Searches ordered"), from the payload's milestone
    // codes — so the drawer names the thing, not just "Client chase". Null for
    // non-chase mail and rows with no milestone codes stored.
    contextLabel: string | null;
    // 1-based "this is chase N", from ClientChaseState. Null off the chase path.
    chaseNumber: number | null;
    // Client emails always have their real rendered HTML → openable in a new tab.
    canOpenInNewWindow: boolean;
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
      recipientContactId: true,
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

  const payload = (email.payload ?? {}) as { subject?: string; text?: string; html?: string; milestoneCodes?: string[] };

  // Name the step being chased + which chase this is. Both derive from the
  // chase payload's milestone codes; non-chase mail leaves them null.
  const codes = Array.isArray(payload.milestoneCodes) ? payload.milestoneCodes : [];
  let contextLabel: string | null = null;
  let chaseNumber: number | null = null;
  if (email.emailType === "CLIENT_CHASE" && codes.length > 0) {
    contextLabel = codes.length === 1
      ? getMilestoneCopy(codes[0]).label
      : `${codes.length} steps outstanding`;
    if (email.recipientContactId) {
      const ccs = await prisma.clientChaseState.findFirst({
        where: { transactionId: email.recipientContact!.propertyTransactionId, contactId: email.recipientContactId, milestoneCode: codes[0] },
        select: { chaseCount: true },
      });
      // This send is the (count-so-far + 1)th chase. Before it has ever sent,
      // chaseCount is 0, so the pending row reads "Chase 1 of 2".
      chaseNumber = (ccs?.chaseCount ?? 0) + 1;
    }
  }

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
      contextLabel,
      chaseNumber,
      canOpenInNewWindow: true,
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

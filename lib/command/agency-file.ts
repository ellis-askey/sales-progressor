// lib/command/agency-file.ts
//
// The "Agency File" — the founder's single, deep view of ONE customer agency.
// Command Centre only (superadmin). This is the home for everything we already
// know about an agency but never showed: its settings snapshot, its team, its
// sales with real progression + chase health (Tier 1b), its client-email
// delivery log (Tier 1c), and client reachability (Tier 1d).
//
// Each tier adds a section to this one page; this module exposes one fetcher per
// section so the page stays a thin presentational component. All reads go
// through commandDb (superadmin context). Internal/test agencies are allowed
// here (unlike revenue) — the founder may want to inspect them too.

import { commandDb } from "@/lib/command/prisma";
import type { AgencyModeProfile, ClientType, UserRole } from "@prisma/client";

// ─── Settings snapshot + team (Tier 1a) ──────────────────────────────────────

export type AgencyTeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  canViewAllFiles: boolean;
};

export type AgencySettingsSnapshot = {
  // Automation toggles — the chase + update streams.
  chaseEmailsEnabled: boolean;
  solicitorChaseEnabled: boolean;
  enquiryReplyChaseEnabled: boolean;
  enquiryRaiseChaseEnabled: boolean;
  advisorChaseEnabled: boolean;
  weeklyClientUpdatesEnabled: boolean;
  chainNeighbourUpdatesEnabled: boolean;
  whatsAppCaptureEnabled: boolean;
  whatsAppTasksEnabled: boolean;
  clientChaseEscalateAfter: number;
  // What clients see on the portal.
  showPortalKeyDates: boolean;
  showPortalCosts: boolean;
  showPortalProgressPercent: boolean;
  showPortalWelcomeSheet: boolean;
  autoInviteClientsOnAdd: boolean;
  // Branding.
  hasLogo: boolean;
  hasEmailTheme: boolean;
  logoTileColor: string | null;
  // Sender.
  quoteSenderEmail: string | null;
  quoteSenderVerified: boolean;
  // Money.
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
  monthlyFeeTargetPence: number | null;
  // Billing / payment lifecycle.
  stripeCustomerId: string | null;
  paymentFailedAt: Date | null;
  newFileCreationBlockedAt: Date | null;
  vatRegisteredAt: Date | null;
  // Where this agency came from.
  signupSource: string | null;
  signupMedium: string | null;
  signupCampaign: string | null;
  signupTier: string | null;
  signupCtaLocation: string | null;
  signupAt: Date | null;
};

export type AgencyFileHeader = {
  id: string;
  name: string;
  modeProfile: AgencyModeProfile;
  isInternal: boolean;
  createdAt: Date;
  firstSubmissionAt: Date | null;
  archivedAt: Date | null;
  activeFileCount: number;
  totalFileCount: number;
  team: AgencyTeamMember[];
  settings: AgencySettingsSnapshot;
};

/**
 * Header + settings snapshot + team for one agency. Returns null if the agency
 * id is unknown. Active = not withdrawn/cancelled (the files the agency is
 * actually working).
 */
export async function getAgencyFileHeader(agencyId: string): Promise<AgencyFileHeader | null> {
  const agency = await commandDb.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true, name: true, modeProfile: true, isInternal: true, createdAt: true,
      firstSubmissionAt: true, archivedAt: true,
      chaseEmailsEnabled: true, solicitorChaseEnabled: true, enquiryReplyChaseEnabled: true,
      enquiryRaiseChaseEnabled: true, advisorChaseEnabled: true, weeklyClientUpdatesEnabled: true,
      chainNeighbourUpdatesEnabled: true, whatsAppCaptureEnabled: true, whatsAppTasksEnabled: true,
      clientChaseEscalateAfter: true,
      showPortalKeyDates: true, showPortalCosts: true, showPortalProgressPercent: true,
      showPortalWelcomeSheet: true, autoInviteClientsOnAdd: true,
      logoPath: true, emailTheme: true, logoTileColor: true,
      quoteSenderEmail: true, quoteSenderVerified: true,
      feeTier: true, legacyOutsourcedFeePence: true, monthlyFeeTargetPence: true,
      stripeCustomerId: true, paymentFailedAt: true, newFileCreationBlockedAt: true,
      vatRegisteredAt: true,
      signupSource: true, signupMedium: true, signupCampaign: true, signupTier: true,
      signupCtaLocation: true, signupAt: true,
      users: {
        select: {
          id: true, name: true, email: true, role: true, lastLoginAt: true,
          deactivatedAt: true, canViewAllFiles: true,
        },
        orderBy: [{ deactivatedAt: "asc" }, { lastLoginAt: "desc" }],
      },
    },
  });
  if (!agency) return null;

  // Active files = anything not withdrawn/cancelled/completed still being worked.
  // "Active" for this header mirrors the revenue drill's notion: not withdrawn.
  const [activeFileCount, totalFileCount] = await Promise.all([
    commandDb.propertyTransaction.count({
      where: { agencyId, status: { notIn: ["withdrawn", "completed"] } },
    }),
    commandDb.propertyTransaction.count({ where: { agencyId } }),
  ]);

  return {
    id: agency.id,
    name: agency.name,
    modeProfile: agency.modeProfile,
    isInternal: agency.isInternal,
    createdAt: agency.createdAt,
    firstSubmissionAt: agency.firstSubmissionAt,
    archivedAt: agency.archivedAt,
    activeFileCount,
    totalFileCount,
    team: agency.users.map((u) => ({
      id: u.id,
      name: u.name ?? "(no name)",
      email: u.email,
      role: u.role,
      lastLoginAt: u.lastLoginAt,
      deactivatedAt: u.deactivatedAt,
      canViewAllFiles: u.canViewAllFiles,
    })),
    settings: {
      chaseEmailsEnabled: agency.chaseEmailsEnabled,
      solicitorChaseEnabled: agency.solicitorChaseEnabled,
      enquiryReplyChaseEnabled: agency.enquiryReplyChaseEnabled,
      enquiryRaiseChaseEnabled: agency.enquiryRaiseChaseEnabled,
      advisorChaseEnabled: agency.advisorChaseEnabled,
      weeklyClientUpdatesEnabled: agency.weeklyClientUpdatesEnabled,
      chainNeighbourUpdatesEnabled: agency.chainNeighbourUpdatesEnabled,
      whatsAppCaptureEnabled: agency.whatsAppCaptureEnabled,
      whatsAppTasksEnabled: agency.whatsAppTasksEnabled,
      clientChaseEscalateAfter: agency.clientChaseEscalateAfter,
      showPortalKeyDates: agency.showPortalKeyDates,
      showPortalCosts: agency.showPortalCosts,
      showPortalProgressPercent: agency.showPortalProgressPercent,
      showPortalWelcomeSheet: agency.showPortalWelcomeSheet,
      autoInviteClientsOnAdd: agency.autoInviteClientsOnAdd,
      hasLogo: !!agency.logoPath,
      hasEmailTheme: agency.emailTheme != null,
      logoTileColor: agency.logoTileColor,
      quoteSenderEmail: agency.quoteSenderEmail,
      quoteSenderVerified: agency.quoteSenderVerified,
      feeTier: agency.feeTier,
      legacyOutsourcedFeePence: agency.legacyOutsourcedFeePence,
      monthlyFeeTargetPence: agency.monthlyFeeTargetPence,
      stripeCustomerId: agency.stripeCustomerId,
      paymentFailedAt: agency.paymentFailedAt,
      newFileCreationBlockedAt: agency.newFileCreationBlockedAt,
      vatRegisteredAt: agency.vatRegisteredAt,
      signupSource: agency.signupSource,
      signupMedium: agency.signupMedium,
      signupCampaign: agency.signupCampaign,
      signupTier: agency.signupTier,
      signupCtaLocation: agency.signupCtaLocation,
      signupAt: agency.signupAt,
    },
  };
}

// ─── Sales with progression + chase health (Tier 1b) ─────────────────────────

export type AgencySaleRow = {
  transactionId: string;
  propertyAddress: string;
  onHold: boolean;
  serviceType: "self_managed" | "outsourced" | null;
  stage: "Onboarding" | "Conveyancing" | "Pre-exchange" | "Post-exchange";
  stepsDone: number;
  stepsLive: number; // done + available (the steps that "count")
  percent: number;
  // Chase health.
  pendingChases: number;
  escalatedChases: number;
  overdueChases: number;
  maxChaseCount: number;
  // Movement.
  lastActivityAt: Date | null;
  idleDays: number | null;
  predictedExchangeDate: Date | null;
  expectedExchangeDate: Date | null;
  isExchangeOverdue: boolean;
};

const STAGE_BY_PHASE: Record<string, AgencySaleRow["stage"]> = {
  onboarding: "Onboarding",
  conveyancing: "Conveyancing",
  pre_exchange: "Pre-exchange",
  post_exchange: "Post-exchange",
};

/**
 * Every live file (active / on hold) for an agency, each with a real stage,
 * step progress, and chase health (pending / escalated / overdue). Ordered most
 * recently worked first. Demo files excluded. Uses detectPhase for the stage so
 * it matches the agent-app hero's notion of where the file is.
 */
export async function getAgencySales(agencyId: string, now: Date): Promise<AgencySaleRow[]> {
  // Lazy import keeps the heavy fees module out of the Tier-1a header path.
  const { detectPhase } = await import("@/lib/services/fees");

  const files = await commandDb.propertyTransaction.findMany({
    where: { agencyId, status: { in: ["active", "on_hold"] }, isDemo: false },
    select: {
      id: true, propertyAddress: true, status: true, serviceType: true,
      lastActivityAt: true, predictedExchangeDate: true, expectedExchangeDate: true,
      milestoneCompletions: {
        select: { state: true, milestoneDefinition: { select: { code: true } } },
      },
      chaseTasks: {
        where: { status: "pending" },
        select: { priority: true, chaseCount: true, dueDate: true },
      },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  return files.map((f) => {
    const completedCodes = new Set<string>();
    let stepsDone = 0;
    let stepsLive = 0;
    for (const c of f.milestoneCompletions) {
      if (c.state === "complete") {
        stepsDone++;
        stepsLive++;
        completedCodes.add(c.milestoneDefinition.code);
      } else if (c.state === "available") {
        stepsLive++;
      }
    }
    const { fileLevelPhase } = detectPhase(completedCodes);
    const percent = stepsLive > 0 ? Math.round((stepsDone / stepsLive) * 100) : 0;

    const pendingChases = f.chaseTasks.length;
    const escalatedChases = f.chaseTasks.filter((t) => t.priority === "escalated").length;
    const overdueChases = f.chaseTasks.filter((t) => t.dueDate < now).length;
    const maxChaseCount = f.chaseTasks.reduce((m, t) => Math.max(m, t.chaseCount), 0);

    const idleDays = f.lastActivityAt
      ? Math.floor((now.getTime() - f.lastActivityAt.getTime()) / 86_400_000)
      : null;
    const predicted = f.predictedExchangeDate;

    return {
      transactionId: f.id,
      propertyAddress: f.propertyAddress,
      onHold: f.status === "on_hold",
      serviceType: f.serviceType,
      stage: STAGE_BY_PHASE[fileLevelPhase] ?? "Onboarding",
      stepsDone,
      stepsLive,
      percent,
      pendingChases,
      escalatedChases,
      overdueChases,
      maxChaseCount,
      lastActivityAt: f.lastActivityAt,
      idleDays,
      predictedExchangeDate: predicted,
      expectedExchangeDate: f.expectedExchangeDate,
      isExchangeOverdue: predicted != null && predicted < now,
    };
  });
}

// ─── Client email log + delivery (Tier 1c) ───────────────────────────────────

export type EmailDeliveryState = "pending" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";

export type AgencyEmailRow = {
  id: string;
  sentAt: Date | null;
  recipientName: string | null;
  recipientEmail: string | null;
  subject: string | null;
  propertyAddress: string | null;
  isAutomated: boolean;
  state: EmailDeliveryState;
  failureReason: string | null;
};

export type AgencyEmailSummary = {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bouncedFailed: number;
  /** Opened / sent, as a 0-100 integer. Of-sent (not of-delivered) so a sparse
   *  delivery webhook can't shrink the denominator and mislead. */
  openRatePct: number;
  rows: AgencyEmailRow[];
  rowLimit: number;
};

function deliveryState(m: {
  status: string; sentAt: Date | null; deliveredAt: Date | null;
  openedAt: Date | null; clickedAt: Date | null; failedAt: Date | null;
}): EmailDeliveryState {
  if (m.status === "bounced") return "bounced";
  if (m.failedAt || m.status === "failed") return "failed";
  if (m.clickedAt) return "clicked";
  if (m.openedAt) return "opened";
  if (m.deliveredAt) return "delivered";
  if (m.sentAt) return "sent";
  return "pending";
}

/**
 * Every client-facing email this agency has sent — recipient, subject, and real
 * delivery status (sent → delivered → opened → clicked, or bounced / failed) —
 * plus headline counts and an open rate. The single biggest gap we're closing:
 * this data was recorded all along and shown nowhere. Reads OutboundMessage
 * (the canonical comms log, which carries the SendGrid lifecycle). Only genuine
 * sends (channel email, actually sent) are counted. Newest first, capped.
 */
export async function getAgencyEmailLog(agencyId: string, rowLimit = 100): Promise<AgencyEmailSummary> {
  const base = {
    agencyId,
    channel: "email" as const,
    sentAt: { not: null },
    recipientEmail: { not: null },
  };

  const [totalSent, delivered, opened, clicked, bouncedFailed, recent] = await Promise.all([
    commandDb.outboundMessage.count({ where: base }),
    commandDb.outboundMessage.count({ where: { ...base, deliveredAt: { not: null } } }),
    commandDb.outboundMessage.count({ where: { ...base, openedAt: { not: null } } }),
    commandDb.outboundMessage.count({ where: { ...base, clickedAt: { not: null } } }),
    commandDb.outboundMessage.count({
      where: { ...base, OR: [{ status: "bounced" }, { failedAt: { not: null } }] },
    }),
    commandDb.outboundMessage.findMany({
      where: base,
      orderBy: { sentAt: "desc" },
      take: rowLimit,
      select: {
        id: true, sentAt: true, recipientName: true, recipientEmail: true, subject: true,
        status: true, deliveredAt: true, openedAt: true, clickedAt: true, failedAt: true,
        failureReason: true, isAutomated: true,
        transaction: { select: { propertyAddress: true } },
      },
    }),
  ]);

  return {
    totalSent,
    delivered,
    opened,
    clicked,
    bouncedFailed,
    openRatePct: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
    rowLimit,
    rows: recent.map((m) => ({
      id: m.id,
      sentAt: m.sentAt,
      recipientName: m.recipientName,
      recipientEmail: m.recipientEmail,
      subject: m.subject,
      propertyAddress: m.transaction?.propertyAddress ?? null,
      isAutomated: m.isAutomated,
      state: deliveryState(m),
      failureReason: m.failureReason,
    })),
  };
}

// ─── Reachability: who's unreachable / what's paused (Tier 1d) ────────────────

export type ReachabilityIssue = "bounced" | "unsubscribed" | "paused";

export type UnreachableContact = {
  contactId: string;
  name: string;
  email: string | null;
  role: string;
  propertyAddress: string;
  issues: ReachabilityIssue[];
  since: Date | null;
};

export type PausedFile = {
  transactionId: string;
  propertyAddress: string;
  scope: "whole file" | "some parties";
};

export type AgencyReachability = {
  contacts: UnreachableContact[];
  pausedFiles: PausedFile[];
  bouncedCount: number;
  unsubscribedCount: number;
  pausedContactCount: number;
};

/**
 * The client-reachability picture for an agency: contacts whose email has
 * bounced, who've unsubscribed, or whose reminders are paused; plus live files
 * with client automation switched off. This is the "silent why isn't it
 * sending" answer — all collected today, surfaced nowhere.
 */
export async function getAgencyReachability(agencyId: string, now: Date): Promise<AgencyReachability> {
  const liveTx = { agencyId, status: { in: ["active", "on_hold"] as ("active" | "on_hold")[] } };

  const [problemContacts, pausedWhole, bouncedCount, unsubscribedCount, pausedContactCount] = await Promise.all([
    commandDb.contact.findMany({
      where: {
        transaction: liveTx,
        OR: [
          { emailBouncedAt: { not: null } },
          { unsubscribedAt: { not: null } },
          { emailsPausedAt: { not: null } },
          { chasesPausedUntil: { gt: now } },
        ],
      },
      select: {
        id: true, name: true, email: true, roleType: true,
        emailBouncedAt: true, unsubscribedAt: true, emailsPausedAt: true, chasesPausedUntil: true,
        transaction: { select: { propertyAddress: true } },
      },
      take: 200,
    }),
    commandDb.propertyTransaction.findMany({
      where: { ...liveTx, clientEmailsPaused: true },
      select: { id: true, propertyAddress: true },
      orderBy: { lastActivityAt: "desc" },
    }),
    commandDb.contact.count({ where: { transaction: liveTx, emailBouncedAt: { not: null } } }),
    commandDb.contact.count({ where: { transaction: liveTx, unsubscribedAt: { not: null } } }),
    commandDb.contact.count({
      where: {
        transaction: liveTx,
        OR: [{ emailsPausedAt: { not: null } }, { chasesPausedUntil: { gt: now } }],
      },
    }),
  ]);

  const contacts: UnreachableContact[] = problemContacts.map((c) => {
    const issues: ReachabilityIssue[] = [];
    if (c.emailBouncedAt) issues.push("bounced");
    if (c.unsubscribedAt) issues.push("unsubscribed");
    if (c.emailsPausedAt || (c.chasesPausedUntil && c.chasesPausedUntil > now)) issues.push("paused");
    const since = c.emailBouncedAt ?? c.unsubscribedAt ?? c.emailsPausedAt ?? c.chasesPausedUntil ?? null;
    return {
      contactId: c.id,
      name: c.name,
      email: c.email,
      role: c.roleType,
      propertyAddress: c.transaction?.propertyAddress ?? "—",
      issues,
      since,
    };
  });
  // Bounced first (hard failure), then unsubscribed, then paused.
  const rank = (c: UnreachableContact) => c.issues.includes("bounced") ? 0 : c.issues.includes("unsubscribed") ? 1 : 2;
  contacts.sort((a, b) => rank(a) - rank(b));

  return {
    contacts,
    pausedFiles: pausedWhole.map((f) => ({
      transactionId: f.id,
      propertyAddress: f.propertyAddress,
      scope: "whole file" as const,
    })),
    bouncedCount,
    unsubscribedCount,
    pausedContactCount,
  };
}

// ─── Shared formatters (Command Centre dark style) ────────────────────────────

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
  }).format(d);
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(d);
}

export function fmtGBP(pence: number | null | undefined): string {
  if (pence == null) return "—";
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** "3 days ago" / "today" / "—" in a compact human form, London-anchored. */
export function fmtAgo(d: Date | null | undefined, now: Date): string {
  if (!d) return "never";
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

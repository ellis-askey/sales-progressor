// Agency join requests (Fix 8). See docs/active/signup-request-to-join/SPEC.md.
//
// Lifecycle: a person signs up with a work email matching an agency's verified
// domain -> a pending AgencyJoinRequest is created and the agency's director(s)
// are notified. A director approves (choosing the role, defaulted to what the
// person picked) -> the requester User is stamped with agencyId + role, exactly
// like accepting a negotiator invitation. Reject -> the requester stays a
// no-agency viewer and is told, politely, to contact their administrator.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { createNotification } from "@/lib/services/notifications";
import { sendEmail } from "@/lib/email";

const SUPPORT_EMAIL = "support@thesalesprogressor.co.uk";
const JOIN_REQUEST_TTL_DAYS = 7;

function appUrl(): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://portal.thesalesprogressor.co.uk";
}

/**
 * Create (or return the existing open) pending join request for a requester, then
 * notify the agency's director(s). Idempotent per requester: a second signup while
 * a request is already pending returns the same row without re-notifying.
 */
export async function createJoinRequest(input: {
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  agencyId: string;
  requestedRole: UserRole;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.agencyJoinRequest.findFirst({
    where: { requesterUserId: input.requesterUserId, status: "pending" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const expiresAt = new Date(Date.now() + JOIN_REQUEST_TTL_DAYS * 24 * 3600 * 1000);
  const req = await prisma.agencyJoinRequest.create({
    data: {
      agencyId: input.agencyId,
      requesterUserId: input.requesterUserId,
      requesterEmail: input.requesterEmail.toLowerCase().trim(),
      requesterName: input.requesterName,
      requestedRole: input.requestedRole,
      expiresAt,
    },
    select: { id: true },
  });

  await notifyDirectorsOfJoinRequest(req.id).catch((err) =>
    console.error("[agency-join-requests] notify failed", req.id, err),
  );
  return { id: req.id, created: true };
}

/** Notify every director of the agency (in-app + email). No director -> email support. */
export async function notifyDirectorsOfJoinRequest(requestId: string): Promise<void> {
  const req = await prisma.agencyJoinRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, agencyId: true, requesterName: true, requesterEmail: true, requestedRole: true,
      agency: { select: { name: true } },
    },
  });
  if (!req) return;

  const directors = await prisma.user.findMany({
    where: { agencyId: req.agencyId, role: "director", isDemo: false },
    select: { id: true, name: true, email: true },
  });

  const teamUrl = `${appUrl()}/agent/account/team`;
  const roleWord = req.requestedRole === "director" ? "a director" : "a negotiator";
  const subject = `${req.requesterName} has asked to join ${req.agency.name} on The Sales Progressor`;
  const body =
    `${req.requesterName} (${req.requesterEmail}) signed up and asked to join ${req.agency.name} as ${roleWord}.\n\n` +
    `Review the request and approve or decline it here:\n${teamUrl}\n\n` +
    `If this isn't someone from your team, decline it and no account will be added.`;

  if (directors.length === 0) {
    // No-director fallback (D4): let TSP handle it. The request still persists.
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[No director] ${subject}`,
      text: `No active director on ${req.agency.name} to approve this join request.\n\n${body}`,
    }).catch(() => {});
    return;
  }

  for (const d of directors) {
    await createNotification({
      userId: d.id,
      type: "agency_join_request",
      payload: {
        title: `${req.requesterName} asked to join`,
        body: `They signed up as ${roleWord}. Review in Team settings.`,
        requestId: req.id,
      },
    }).catch(() => {});
    if (d.email) {
      await sendEmail({ to: d.email, subject, text: body }).catch(() => {});
    }
  }
}

/** The requester's current pending request (for routing + the pending page). */
export async function getPendingJoinRequestForUser(userId: string): Promise<
  { id: string; agencyName: string } | null
> {
  const r = await prisma.agencyJoinRequest.findFirst({
    where: { requesterUserId: userId, status: "pending" },
    select: { id: true, agency: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return r ? { id: r.id, agencyName: r.agency.name } : null;
}

/**
 * The requester's MOST RECENT request of any status. Used to decide routing: a
 * pending request -> the pending page; a decided one (rejected/expired) -> let
 * them create their own agency instead of auto-re-requesting (prevents a loop
 * for someone whose email still matches the verified domain).
 */
export async function getLatestJoinRequestForUser(userId: string): Promise<
  { id: string; status: string; agencyName: string } | null
> {
  const r = await prisma.agencyJoinRequest.findFirst({
    where: { requesterUserId: userId },
    select: { id: true, status: true, agency: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return r ? { id: r.id, status: r.status, agencyName: r.agency.name } : null;
}

/** Director-facing: pending requests for their agency. */
export async function listPendingJoinRequests(agencyId: string) {
  return prisma.agencyJoinRequest.findMany({
    where: { agencyId, status: "pending" },
    select: { id: true, requesterName: true, requesterEmail: true, requestedRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Approve: stamp agencyId + role onto the requester User (mirrors the negotiator
 * invite-accept transaction), mark the request approved, and tell the requester.
 * Director-only + agency-scoped enforcement happens in the calling server action.
 */
export async function approveJoinRequest(input: {
  requestId: string;
  decidedByUserId: string;
  agencyId: string; // the approver's agency, for the scope guard
  role: UserRole; // director | negotiator
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const req = await prisma.agencyJoinRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, agencyId: true, status: true, requesterUserId: true, requesterName: true, requesterEmail: true },
  });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.agencyId !== input.agencyId) return { ok: false, error: "Not your agency's request." };
  if (req.status !== "pending") return { ok: false, error: "This request has already been handled." };

  const inviter = await prisma.user.findFirst({
    where: { agencyId: req.agencyId, role: "director" },
    select: { firmName: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: req.requesterUserId },
      data: { agencyId: req.agencyId, role: input.role, firmName: inviter?.firmName ?? undefined },
    });
    await tx.agencyJoinRequest.update({
      where: { id: req.id },
      data: { status: "approved", decidedByUserId: input.decidedByUserId, decidedAt: new Date() },
    });
  });

  // Tell the requester they're in. Their session picks up the new agency on the
  // next request (the jwt needsSignupCompletion re-read clears once agencyId is set).
  await createNotification({
    userId: req.requesterUserId,
    type: "agency_join_approved",
    payload: { title: "You're in", body: "Your request to join was approved." },
  }).catch(() => {});
  await sendEmail({
    to: req.requesterEmail,
    subject: "You've been approved on The Sales Progressor",
    text: `Good news, ${req.requesterName}. Your request to join your agency has been approved.\n\nLog in to get started:\n${appUrl()}/login`,
  }).catch(() => {});

  return { ok: true };
}

/** Reject: leave the requester as a no-agency viewer, tell them politely. */
export async function rejectJoinRequest(input: {
  requestId: string;
  decidedByUserId: string;
  agencyId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const req = await prisma.agencyJoinRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, agencyId: true, status: true, requesterUserId: true, requesterName: true, requesterEmail: true },
  });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.agencyId !== input.agencyId) return { ok: false, error: "Not your agency's request." };
  if (req.status !== "pending") return { ok: false, error: "This request has already been handled." };

  await prisma.agencyJoinRequest.update({
    where: { id: req.id },
    data: { status: "rejected", decidedByUserId: input.decidedByUserId, decidedAt: new Date() },
  });

  await createNotification({
    userId: req.requesterUserId,
    type: "agency_join_rejected",
    payload: { title: "Request not approved", body: "Your request to join wasn't approved." },
  }).catch(() => {});
  await sendEmail({
    to: req.requesterEmail,
    subject: "Update on your request to join",
    text:
      `Hello ${req.requesterName}. Your request to join your agency on The Sales Progressor wasn't approved.\n\n` +
      `If you think this is a mistake, contact your agency administrator. You can also set up your own agency at ${appUrl()}/register.`,
  }).catch(() => {});

  return { ok: true };
}

/** Nightly sweep: expire stale pending requests and tell the requester. */
export async function expireStaleJoinRequests(now: Date = new Date()): Promise<number> {
  const stale = await prisma.agencyJoinRequest.findMany({
    where: { status: "pending", expiresAt: { lt: now } },
    select: { id: true, requesterUserId: true, requesterName: true, requesterEmail: true },
  });
  for (const r of stale) {
    await prisma.agencyJoinRequest.update({ where: { id: r.id }, data: { status: "expired" } }).catch(() => {});
    await sendEmail({
      to: r.requesterEmail,
      subject: "Your request to join has expired",
      text:
        `Hello ${r.requesterName}. Your request to join your agency wasn't actioned in time and has expired.\n\n` +
        `Ask your agency administrator to invite you, or set up your own agency at ${appUrl()}/register.`,
    }).catch(() => {});
  }
  return stale.length;
}

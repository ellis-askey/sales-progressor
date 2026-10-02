// lib/security/access-scope.ts
// Package D: access scope helper for the outsourced workflow fix.
//
// Replaces the broken pattern where every ownership check used
// `agencyId: session.user.agencyId`, which is "" for internal staff and
// matches no rows in the database.
//
// Usage:
//   const scope = getAccessScope(session);
//   const where = scopeTransactionWhere(scope);         // for listTransactions
//   const where = scopeOwnershipWhere(scope, txId);     // for single-tx guards

import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { hasAdminPowers } from "@/lib/agent-session";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccessScope =
  | { kind: "agency";   agencyIds: string[] }  // director, negotiator, viewer
  | { kind: "business"; businessId: string }    // external progression-business member — own business's book
  | { kind: "assigned"; userId: string }        // TSP sales_progressor — own assigned files
  | { kind: "all" };                            // admin, superadmin — no agency filter

// A TSP-only transaction filter. TSP's own files have progressionBusinessId null
// (schema: null = TSP, no backfill) or, defensively, the seeded TSP business row
// (isTsp). An EXTERNAL progression business's files (a non-TSP progressionBusiness)
// must NEVER appear on TSP's own dashboard / lists / file access — two separate
// businesses, no contamination. TSP sees an external business's data only in the
// (separate, commandDb-backed) Command Centre, which does not use these helpers.
// Applied to the admin/superadmin "all" scope below.
// AND-wrapped so it is safe to SPREAD into a where that already has its own
// top-level `OR` (e.g. round-scoping) — a second top-level `OR` would overwrite
// the first, but an `AND` entry composes. Spread as `{ ...where, ...TSP_ONLY_TX_WHERE }`
// or nest as `transaction: TSP_ONLY_TX_WHERE`.
export const TSP_ONLY_TX_WHERE: Prisma.PropertyTransactionWhereInput = {
  AND: [{ OR: [{ progressionBusinessId: null }, { progressionBusiness: { isTsp: true } }] }],
};

// ─── Derive scope from session ────────────────────────────────────────────────

export function getAccessScope(session: Session): AccessScope {
  const { role, agencyId, id, progressionBusinessId } = session.user;

  // hasAdminPowers covers admin, superadmin, and the hybrid sales_progressor
  // exception (ellis). Hybrid users get full-platform visibility while keeping
  // role = "sales_progressor" so the SP daily UX (hub assigned lane, isProgressor
  // checks) stays intact. This is checked FIRST so the platform operator always
  // wins regardless of any progression-business membership.
  if (hasAdminPowers(session)) {
    return { kind: "all" };
  }

  // External progression-business member: bounded to the book of transactions
  // tagged to their business (PropertyTransaction.progressionBusinessId). The
  // access boundary is the TRANSACTION, never the business↔agency client link.
  // TSP internal progressors keep progressionBusinessId = null (they resolve to
  // TSP implicitly and fall through to the "assigned" scope below), so a
  // non-null id here means a genuine external business. Never assign the TSP
  // business id to a user — TSP members must stay null (see
  // docs/active/progression-businesses/00-spec.md).
  if (role === "sales_progressor" && progressionBusinessId) {
    return { kind: "business", businessId: progressionBusinessId };
  }

  if (role === "sales_progressor") {
    return { kind: "assigned", userId: id };
  }

  // director, negotiator, viewer — scoped to their single agency
  return { kind: "agency", agencyIds: [agencyId] };
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Prisma where clause for listing transactions (no specific tx id).
 * Used by listTransactions() and count queries on /dashboard.
 *
 * "all"      → no filter (admin sees everything)
 * "assigned" → assignedUserId = own id (sales_progressor sees their files)
 * "agency"   → agencyId in own agency list (agent sees their agency)
 */
export function scopeTransactionWhere(
  scope: AccessScope
): Prisma.PropertyTransactionWhereInput {
  // Internal staff (founder / admin / superadmin = "all", internal progressor =
  // "assigned") must NEVER see demo files. Any agency can spin up a demo sale to
  // explore the product, and that data must not pollute our cross-platform lists,
  // partner directories, or analytics. Agency users keep seeing their OWN demo
  // (they created it to look through), so the "agency" branch stays unfiltered.
  if (scope.kind === "all")      return { isDemo: false, ...TSP_ONLY_TX_WHERE };
  if (scope.kind === "assigned") return { assignedUserId: scope.userId, isDemo: false };
  // External progression business — its own book only, keyed on the transaction
  // tag. Demo files are excluded like the other non-agency scopes.
  if (scope.kind === "business") return { progressionBusinessId: scope.businessId, isDemo: false };
  return { agencyId: { in: scope.agencyIds } };
}

/**
 * Prisma where clause for a single-transaction ownership guard.
 * Use in findFirst() before any read or mutation on a specific transaction.
 *
 * "all"      → { id } — no agencyId restriction
 * "assigned" → { id, assignedUserId } — must be assigned to self
 * "agency"   → { id, agencyId } — same as current inline pattern
 */
export function scopeOwnershipWhere(
  scope: AccessScope,
  transactionId: string
): Prisma.PropertyTransactionWhereInput {
  if (scope.kind === "all")      return { id: transactionId, ...TSP_ONLY_TX_WHERE };
  if (scope.kind === "assigned") return { id: transactionId, assignedUserId: scope.userId };
  if (scope.kind === "business") return { id: transactionId, progressionBusinessId: scope.businessId };
  // agency — agencyIds always has exactly one entry for a non-internal user
  return { id: transactionId, agencyId: scope.agencyIds[0] };
}

/**
 * Prisma where clause for a ChaseTask, verifying the related transaction is in scope.
 * Use in findFirst() before mutating a chase task in a server action.
 */
export function scopeChaseTaskWhere(
  scope: AccessScope,
  taskId: string
): Prisma.ChaseTaskWhereInput {
  if (scope.kind === "all")      return { id: taskId, transaction: TSP_ONLY_TX_WHERE };
  if (scope.kind === "assigned") return { id: taskId, transaction: { assignedUserId: scope.userId } };
  if (scope.kind === "business") return { id: taskId, transaction: { progressionBusinessId: scope.businessId } };
  return { id: taskId, transaction: { agencyId: scope.agencyIds[0] } };
}

/**
 * Prisma where clause for a ReminderLog, verifying the related transaction is in scope.
 */
export function scopeReminderLogWhere(
  scope: AccessScope,
  logId: string
): Prisma.ReminderLogWhereInput {
  if (scope.kind === "all")      return { id: logId, transaction: TSP_ONLY_TX_WHERE };
  if (scope.kind === "assigned") return { id: logId, transaction: { assignedUserId: scope.userId } };
  if (scope.kind === "business") return { id: logId, transaction: { progressionBusinessId: scope.businessId } };
  return { id: logId, transaction: { agencyId: scope.agencyIds[0] } };
}

/**
 * Boolean check — does this scope allow reading this transaction?
 * Use for in-memory checks where the transaction is already loaded.
 */
export function canReadTransaction(
  scope: AccessScope,
  tx: {
    agencyId: string;
    assignedUserId: string | null;
    // Required for the "business" branch. Callers that may pass a business scope
    // MUST select this; when absent it reads as undefined and fails closed.
    progressionBusinessId?: string | null;
  }
): boolean {
  // "all" (TSP admin) sees TSP's own files only, never an external business's.
  if (scope.kind === "all")      return tx.progressionBusinessId == null;
  if (scope.kind === "assigned") return tx.assignedUserId === scope.userId;
  if (scope.kind === "business") return tx.progressionBusinessId === scope.businessId;
  return scope.agencyIds.includes(tx.agencyId);
}

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

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccessScope =
  | { kind: "agency";   agencyIds: string[] }  // director, negotiator, viewer
  | { kind: "assigned"; userId: string }        // sales_progressor — own assigned files
  | { kind: "all" };                            // admin, superadmin — no agency filter

// ─── Derive scope from session ────────────────────────────────────────────────

export function getAccessScope(session: Session): AccessScope {
  const { role, agencyId, id } = session.user;

  if (role === "admin" || role === "superadmin") {
    return { kind: "all" };
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
  if (scope.kind === "all")      return {};
  if (scope.kind === "assigned") return { assignedUserId: scope.userId };
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
  if (scope.kind === "all")      return { id: transactionId };
  if (scope.kind === "assigned") return { id: transactionId, assignedUserId: scope.userId };
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
  if (scope.kind === "all")      return { id: taskId };
  if (scope.kind === "assigned") return { id: taskId, transaction: { assignedUserId: scope.userId } };
  return { id: taskId, transaction: { agencyId: scope.agencyIds[0] } };
}

/**
 * Prisma where clause for a ReminderLog, verifying the related transaction is in scope.
 */
export function scopeReminderLogWhere(
  scope: AccessScope,
  logId: string
): Prisma.ReminderLogWhereInput {
  if (scope.kind === "all")      return { id: logId };
  if (scope.kind === "assigned") return { id: logId, transaction: { assignedUserId: scope.userId } };
  return { id: logId, transaction: { agencyId: scope.agencyIds[0] } };
}

/**
 * Boolean check — does this scope allow reading this transaction?
 * Use for in-memory checks where the transaction is already loaded.
 */
export function canReadTransaction(
  scope: AccessScope,
  tx: { agencyId: string; assignedUserId: string | null }
): boolean {
  if (scope.kind === "all")      return true;
  if (scope.kind === "assigned") return tx.assignedUserId === scope.userId;
  return scope.agencyIds.includes(tx.agencyId);
}

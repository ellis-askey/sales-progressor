import { prisma } from "@/lib/prisma";

interface AdminActionInput {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAdminAction(input: AdminActionInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      beforeValue: input.beforeValue !== undefined ? (input.beforeValue as object) : undefined,
      afterValue: input.afterValue !== undefined ? (input.afterValue as object) : undefined,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/**
 * Best-effort audit write that NEVER throws.
 *
 * Audit logging is secondary to the mutation it accompanies. Call this AFTER
 * the mutation has already succeeded: if the audit insert fails we must not
 * surface an error to the caller, because the action has in fact happened —
 * reporting failure could make the caller retry and double-execute the real
 * operation. A failed audit write is logged to the server console (for ops
 * follow-up) and swallowed. It never changes the action's return value or
 * side effects.
 *
 * Because callers only invoke this on their success path, a mutation that
 * fails (validation, auth, not-found, DB error) never reaches here — so a
 * failed action is never recorded as a successful audit row.
 */
export async function recordAdminActionSafe(input: AdminActionInput): Promise<void> {
  try {
    await recordAdminAction(input);
  } catch (err) {
    console.error(`[audit] failed to record admin action "${input.action}"`, err);
  }
}

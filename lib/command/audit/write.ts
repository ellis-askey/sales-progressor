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

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Wraps a database operation in a transaction that sets app.current_agency_id
 * before running the query. When strict RLS policies are active (see
 * docs/MANUAL_TASKS.md), this is required for any query against the five
 * RLS-protected tables: PropertyTransaction, User, Contact, ManualTask,
 * SolicitorFirm.
 *
 * Usage:
 *   const txns = await withAgencyRls(session.user.agencyId, (tx) =>
 *     tx.propertyTransaction.findMany({ where: { ... } })
 *   );
 *
 * While the staging bypass policy (USING (true)) is active this wrapper is
 * a no-op from a security standpoint, but the call sites are correct so
 * flipping to strict mode (dropping bypass policies) requires zero code
 * changes.
 */
export async function withAgencyRls<T>(
  agencyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_agency_id', ${agencyId}, TRUE)`;
    return fn(tx);
  });
}

/**
 * Same as withAgencyRls but accepts null for superadmin paths.
 * When agencyId is null the context is not set — strict policies will
 * show ZERO rows for tables that require an agency match. This is intentional:
 * superadmin access should go through the Prisma client directly (bypassing RLS
 * by connecting as a privileged role) rather than through this helper.
 */
export async function withAgencyRlsOrNull<T>(
  agencyId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!agencyId) {
    return prisma.$transaction(async (tx) => fn(tx));
  }
  return withAgencyRls(agencyId, fn);
}

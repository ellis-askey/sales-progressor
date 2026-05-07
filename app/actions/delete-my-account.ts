"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteMyAccount(formData: FormData): Promise<DeleteAccountResult> {
  const session = await requireSession();
  const confirmEmail = formData.get("confirmEmail")?.toString().toLowerCase().trim() ?? "";

  if (confirmEmail !== (session.user.email ?? "").toLowerCase()) {
    return { ok: false, error: "Email confirmation doesn't match." };
  }

  const userId  = session.user.id;
  const agencyId = session.user.agencyId ?? null;

  if (session.user.role === "director" && agencyId) {
    const otherUsers = await prisma.user.count({
      where: { agencyId, id: { not: userId } },
    });
    if (otherUsers > 0) {
      return {
        ok: false,
        error: "Remove all other team members before deleting your account.",
      };
    }

    // Agency deletion requires no transactions — PropertyTransaction.agencyId has no cascade
    const txCount = await prisma.propertyTransaction.count({ where: { agencyId } });
    if (txCount > 0) {
      return {
        ok: false,
        error: "Archive or complete all files before deleting your account.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    // ManualTask.createdById is a required (non-nullable) FK with no onDelete configured.
    // Prisma defaults non-nullable FKs to Restrict, so the user.delete would fail without this.
    await tx.manualTask.deleteMany({ where: { createdById: userId } });

    // VerifiedDomain.createdByUserId is the same situation — required FK, no onDelete.
    await tx.verifiedDomain.deleteMany({ where: { createdByUserId: userId } });

    if (session.user.role === "director" && agencyId) {
      // Agency has required FKs from AgencyRecommendedSolicitor and PropertyChain (both Restrict).
      await tx.agencyRecommendedSolicitor.deleteMany({ where: { agencyId } });
      await tx.propertyChain.deleteMany({ where: { agencyId } });
    }

    // Delete user — Prisma cascades: Account, Session, AgentPushSubscription,
    // UserVerifiedEmail, RetentionEmailLog. Optional FKs set to null.
    await tx.user.delete({ where: { id: userId } });

    if (session.user.role === "director" && agencyId) {
      await tx.agency.delete({ where: { id: agencyId } });
    }
  });

  return { ok: true };
}

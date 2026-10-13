"use server";

// Agent-facing read of the surveyor directory for the survey confirm (critique
// #211, phase 5). ProviderFirm is a shared, non-tenant directory, but the
// DROPDOWN is scoped by relationship (2026-10-13): an agency or external
// progression business only sees firms that have featured on one of THEIR sales
// — either typed in on a survey confirm (PropertyTransaction.bookedSurveyorEmail)
// or booked through the quote flow (QuoteRequest.bookedAt). TSP internal staff
// keep the full directory. Visibility is DERIVED from booking history at read
// time — no ownership column on ProviderFirm, so past bookings count from day
// one and the same firm row serves every party that has used it.
// The write side is a quiet upsert inside confirmMilestoneAction (unlisted firm,
// so it never appears on the buyer quote picker). No commandDb / admin audit
// here; that path is for the Command Centre directory CRUD.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import type { Prisma } from "@prisma/client";

export type SavedSurveyor = { id: string; name: string; email: string; phone: string | null };

export async function getSavedSurveyors(): Promise<SavedSurveyor[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // TSP internal staff (admin/superadmin = "all"; internal progressor =
  // "assigned" with no business) see the whole directory. An external
  // progression-business member resolves to "business" or "assigned" with a
  // progressionBusinessId — never full-directory.
  const businessId = session.user.progressionBusinessId ?? null;
  const isTspInternal =
    scope.kind === "all" || (scope.kind === "assigned" && !businessId);
  if (isTspInternal) {
    return prisma.providerFirm.findMany({
      where: { kind: "surveyor", active: true },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
    });
  }

  // Which sales count as "theirs": the agency's own book (self-progressed AND
  // outsourced — both carry their agencyId), or the external business's book.
  // Surveyor reuse is a business-level memory, so a see-own business member
  // still gets the whole business's history, not just their assigned files.
  const txWhere: Prisma.PropertyTransactionWhereInput = businessId
    ? { progressionBusinessId: businessId, isDemo: false }
    : scopeTransactionWhere(scope);

  const [typedIn, quoteBooked] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, bookedSurveyorEmail: { not: null } },
      select: { bookedSurveyorEmail: true },
    }),
    prisma.quoteRequest.findMany({
      where: { kind: "surveyor", bookedAt: { not: null }, transaction: txWhere },
      select: { providerId: true },
    }),
  ]);

  // bookedSurveyorEmail is stored as typed (not lowercased) while the firm
  // upsert lowercases, so match case-insensitively.
  const emails = [
    ...new Set(typedIn.map((t) => t.bookedSurveyorEmail!.trim().toLowerCase()).filter(Boolean)),
  ];
  const firmIds = [...new Set(quoteBooked.map((q) => q.providerId))];
  if (emails.length === 0 && firmIds.length === 0) return [];

  return prisma.providerFirm.findMany({
    where: {
      kind: "surveyor",
      active: true,
      OR: [
        ...(firmIds.length ? [{ id: { in: firmIds } }] : []),
        ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
  });
}

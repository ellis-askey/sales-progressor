import { prisma } from "@/lib/prisma";
import type { UserRole, ProgressionBusinessRole } from "@prisma/client";

interface CreateProgressionBusinessWithOwnerInput {
  userId?: string;       // if provided, updates existing user (OAuth path)
  name: string;
  email: string;
  password?: string;     // pre-hashed; omit for OAuth users
  businessName: string;
}

interface CreateProgressionBusinessWithOwnerResult {
  userId: string;
  businessId: string;
}

/**
 * Atomically creates a ProgressionBusiness and either creates or updates the
 * owner User row. The self-serve counterpart to createDirectorWithAgency: an
 * independent sales progressor signs up and gets their own bounded business
 * (docs/active/progression-businesses/10-signup-team-billing-spec.md, Arc S4).
 *
 * The owner is a `sales_progressor` (that role carries NO platform power — all
 * TSP-only power lives on admin/superadmin + the hybrid-email allow-list) with
 * agencyId = null and progressionBusinessRole = owner. The transaction, not the
 * agency relationship, is the access boundary (see 00-spec.md).
 *
 * OAuth path (userId provided): the Prisma adapter already created the user on
 * sign-in; we update their role/business. Password path (no userId): creates a
 * fresh user alongside the business. Wrapped in $transaction so a failed user
 * write can't leave an orphan business.
 *
 * NOTE: the Command-Centre Event row (a progression_business_created EventType)
 * is deferred to the team/billing schema work that adds the enum value — the
 * [AUDIT] line below is the interim trace. recordEvent is best-effort telemetry,
 * never on the critical path, so nothing user-facing depends on it.
 */
export async function createProgressionBusinessWithOwner(
  input: CreateProgressionBusinessWithOwnerInput
): Promise<CreateProgressionBusinessWithOwnerResult> {
  return prisma.$transaction(async (tx) => {
    const business = await tx.progressionBusiness.create({
      data: { name: input.businessName, isTsp: false },
      select: { id: true },
    });

    const ownerData = {
      name: input.name,
      role: "sales_progressor" as UserRole,
      agencyId: null,
      progressionBusinessId: business.id,
      progressionBusinessRole: "owner" as ProgressionBusinessRole,
    };

    let userId: string;
    if (input.userId) {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: ownerData,
        select: { id: true },
      });
      userId = updated.id;
    } else {
      const created = await tx.user.create({
        data: {
          ...ownerData,
          email: input.email.toLowerCase().trim(),
          password: input.password,
        },
        select: { id: true },
      });
      userId = created.id;
    }

    console.log(
      `[AUDIT] progression_business_created userId=${userId} businessId=${business.id} via=${input.userId ? "oauth" : "password"}`
    );

    return { userId, businessId: business.id };
  });
}

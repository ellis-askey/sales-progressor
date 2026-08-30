import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { recordEvent } from "@/lib/command/events/write";
import type { SignupAttribution } from "@/lib/analytics/attribution";

interface CreateDirectorWithAgencyInput {
  userId?: string;       // if provided, updates existing user (OAuth path)
  name: string;
  email: string;
  password?: string;     // pre-hashed; omit for OAuth users
  role: "director" | "negotiator";
  agencyName: string;
  firmName?: string;
  // First-touch marketing attribution captured at registration. Written once,
  // at agency creation, onto the Agency.signup* columns.
  attribution?: SignupAttribution | null;
}

interface CreateDirectorWithAgencyResult {
  userId: string;
  agencyId: string;
}

/**
 * Atomically creates an Agency and either creates or updates the User row.
 *
 * OAuth path (userId provided): the user was already created by the Prisma
 * adapter on sign-in; we update their role/agencyId/firmName.
 *
 * Password path (no userId): creates a fresh user alongside the agency.
 *
 * Wrapped in $transaction so a failed user write can't leave an orphan agency.
 */
export async function createDirectorWithAgency(
  input: CreateDirectorWithAgencyInput
): Promise<CreateDirectorWithAgencyResult> {
  const result = await prisma.$transaction(async (tx) => {
    const a = input.attribution;
    const agency = await tx.agency.create({
      data: {
        name: input.agencyName,
        signupAt: new Date(),
        // First-touch attribution (raw values; classified at read time).
        signupSource: a?.source ?? null,
        signupMedium: a?.medium ?? null,
        signupCampaign: a?.campaign ?? null,
        signupTerm: a?.term ?? null,
        signupContent: a?.content ?? null,
        signupReferrer: a?.referrer ?? null,
        signupLandingPage: a?.landingPage ?? null,
        signupTier: a?.tier ?? null,
        signupCtaLocation: a?.ctaLocation ?? null,
      },
    });

    const firmName = input.firmName?.trim() || input.agencyName;

    let userId: string;

    if (input.userId) {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          name: input.name,
          role: input.role as UserRole,
          agencyId: agency.id,
          firmName,
        },
        select: { id: true },
      });
      userId = updated.id;
    } else {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase().trim(),
          password: input.password,
          role: input.role as UserRole,
          agencyId: agency.id,
          firmName,
        },
        select: { id: true },
      });
      userId = created.id;
    }

    console.log(
      `[AUDIT] agency_user_created userId=${userId} agencyId=${agency.id} role=${input.role} via=${input.userId ? "oauth" : "password"}`
    );

    return { userId, agencyId: agency.id };
  });

  // Command Centre event log — fires after the transaction commits so
  // the Event row never references an Agency that rolled back.
  await recordEvent({
    type: "agency_created",
    agencyId: result.agencyId,
    userId: result.userId,
    isInternalUser: false,
    entityType: "Agency",
    entityId: result.agencyId,
    metadata: { role: input.role, via: input.userId ? "oauth" : "password", source: input.attribution?.source ?? null },
  });

  return result;
}

// lib/billing/acknowledgement.ts
//
// Read/write helpers for the pricing-disclosure acknowledgement gate.
// Used by both the page (server component picks the render state) and the
// API endpoints (acknowledge POST writes the row, setup-intent POST checks
// the acknowledgement exists before talking to Stripe).
//
// The disclosure copy itself is NOT in code — it lives in the TermsVersion
// table. `getActiveTermsVersion` returns whichever row has the latest
// effectiveFrom (or null if the table is empty, the PR 6 ship state).
//
// The audit record is the denormalised acknowledgedByName + acknowledgedByEmail
// strings — they survive a future User deletion (SetNull cascade on the FK,
// see PR 1 schema). The FK to User is a convenience pointer.

import { prisma } from "@/lib/prisma";

export type ActiveTermsVersion = {
  id: string;
  versionTag: string;
  body: string;
  effectiveFrom: Date;
};

/**
 * Latest TermsVersion whose effectiveFrom <= now. Null if the table is
 * empty or all rows are future-dated. The PR 6 ship state returns null
 * (no row seeded — terms copy comes from Ellis as a separate step).
 */
export async function getActiveTermsVersion(now: Date = new Date()): Promise<ActiveTermsVersion | null> {
  const row = await prisma.termsVersion.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, versionTag: true, body: true, effectiveFrom: true },
  });
  return row;
}

/**
 * Has the agency already acknowledged this specific TermsVersion?
 * Future terms revisions force a fresh acknowledgement because the FK
 * targets a different TermsVersion.id.
 */
export async function hasAcknowledged(agencyId: string, termsVersionId: string): Promise<boolean> {
  const count = await prisma.pricingAcknowledgement.count({
    where: { agencyId, termsVersionId },
  });
  return count > 0;
}

/**
 * Write the acknowledgement row. Captures the user's name + email AS STRINGS
 * on the row (the durable audit record) alongside the FK to User (which can
 * null out under GDPR erasure without losing the audit trail).
 *
 * Idempotent at the caller level — the API endpoint checks hasAcknowledged
 * before invoking this. Caller should also race-guard against double-clicks
 * if they care; multiple rows are technically allowed by schema (no unique
 * constraint) and that's fine: redundant rows are just redundant audit.
 */
export async function recordAcknowledgement(input: {
  agencyId: string;
  userId: string;
  userName: string;
  userEmail: string;
  termsVersionId: string;
}): Promise<{ id: string }> {
  const row = await prisma.pricingAcknowledgement.create({
    data: {
      agencyId: input.agencyId,
      acknowledgedByUserId: input.userId,
      acknowledgedByName: input.userName,
      acknowledgedByEmail: input.userEmail,
      termsVersionId: input.termsVersionId,
    },
    select: { id: true },
  });
  return row;
}

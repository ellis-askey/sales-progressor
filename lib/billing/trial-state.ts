// lib/billing/trial-state.ts
//
// Helper for the billing-hub "Plan & terms" panel and the brand-new-agency
// state. Computes whether an agency is currently in trial and, if so, how
// many days are left.
//
// The trial window is 14 days from firstSubmissionAt (lib/services/trial.ts
// TRIAL_WINDOW_MS). This helper returns null if firstSubmissionAt is unset
// (agency never submitted) so the UI can render an explicit "haven't
// started yet" state.

import { prisma } from "@/lib/prisma";

export const TRIAL_WINDOW_DAYS = 14;

export type TrialState =
  | { kind: "not_started" }
  | { kind: "in_trial"; daysLeft: number; endsAt: Date }
  | { kind: "trial_ended"; endedAt: Date };

export async function getTrialState(agencyId: string, now: Date = new Date()): Promise<TrialState> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { firstSubmissionAt: true },
  });
  if (!agency || agency.firstSubmissionAt === null) return { kind: "not_started" };

  const endsAt = new Date(agency.firstSubmissionAt.getTime() + TRIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) return { kind: "trial_ended", endedAt: endsAt };
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { kind: "in_trial", daysLeft, endsAt };
}

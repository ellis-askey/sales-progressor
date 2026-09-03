// Automation coverage rollup for /agent/automated-emails.
//
// One row per ACTIVE file in the caller's scope, bucketed into how well
// automation can actually run on it. Answers "for every file we're watching,
// is automation set up and running?" — the health question the KPIs and the
// per-email feed can't, because they only see emails that already exist.
//
//   covered   — automation on, every client contact has an address. Healthy.
//   needInfo  — automation on, but a client contact has no email, so the chase
//               engine can't reach them (it requires an address). A setup gap.
//   paused    — automation is off for this file: the global gate, the agency
//               toggle, or the per-file pause. Nothing sends until resumed.
//
// Scoped through resolveEmailScope like every other module on this surface, so
// the rollup can never count a file the viewer may not see. The needInfo bucket
// is the file-level companion to the "missing email" cards in Needs attention.

import { prisma } from "@/lib/prisma";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";

// The chase cron's global gate (mirrors automated-emails-preview.ts). Anything
// other than the literal "true" leaves every file's chases dormant.
function chaseGloballyPaused(): boolean {
  return process.env.CLIENT_CHASE_ENABLED !== "true";
}

export type AutomationCoverage = {
  total: number;    // active files in scope
  covered: number;
  needInfo: number;
  paused: number;
};

export async function getAutomationCoverage(input: EmailScopeInput): Promise<AutomationCoverage> {
  const { txIds } = await resolveEmailScope(input);
  if (txIds.length === 0) return { total: 0, covered: 0, needInfo: 0, paused: 0 };

  const globalOff = chaseGloballyPaused();
  const txs = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds }, status: "active" },
    select: {
      id: true,
      clientEmailsPaused: true,
      agency: { select: { chaseEmailsEnabled: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { email: true },
      },
    },
  });

  let covered = 0;
  let needInfo = 0;
  let paused = 0;
  for (const t of txs) {
    // Most-global pause wins, matching the preview service's pause precedence.
    if (globalOff || t.agency?.chaseEmailsEnabled === false || t.clientEmailsPaused) {
      paused++;
      continue;
    }
    const missingEmail = t.contacts.some((c) => !c.email || c.email.trim() === "");
    if (missingEmail) needInfo++;
    else covered++;
  }

  return { total: txs.length, covered, needInfo, paused };
}

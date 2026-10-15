// Self-managed agency chase preferences, as the 5 welcome toggles. Derives the
// toggle state from the six Agency chase flags, and the save path writes them back.
//
// Toggle → flag mapping (founder call, 2026-10-06):
//   Client chases          → chaseEmailsEnabled
//   Solicitor chases       → solicitorChaseEnabled   (solicitor confirmations only)
//   Enquiry chases         → enquiryReplyChaseEnabled AND enquiryRaiseChaseEnabled
//   Weekly client updates  → weeklyClientUpdatesEnabled
//   Chain updates          → chainNeighbourUpdatesEnabled
// (Enquiry-RAISE and enquiry-REPLY now both sit under "Enquiry chases", so the one
// enquiries toggle owns all enquiry chasing and "Solicitor chases" is confirmations
// only. This stops the Account/Emails enquiry toggle silently flipping Solicitor.)
//
// These six flags are ALREADY enforced by the live chase engines, so writing them
// is all that's needed for the toggles to take effect.

import { prisma } from "@/lib/prisma";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";

/** Read the current welcome-toggle state for a self-managed agency. Defaults all on
 *  for an unknown id. */
export async function getAgentChasePrefs(agencyId: string): Promise<ProgressorChasePrefs> {
  const a = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      chaseEmailsEnabled: true,
      solicitorChaseEnabled: true,
      enquiryRaiseChaseEnabled: true,
      enquiryReplyChaseEnabled: true,
      weeklyClientUpdatesEnabled: true,
      chainNeighbourUpdatesEnabled: true,
    },
  });
  if (!a) return { client: true, solicitor: true, enquiries: true, weekly: true, chain: true };
  return {
    client: a.chaseEmailsEnabled,
    solicitor: a.solicitorChaseEnabled,
    enquiries: a.enquiryReplyChaseEnabled && a.enquiryRaiseChaseEnabled,
    weekly: a.weeklyClientUpdatesEnabled,
    chain: a.chainNeighbourUpdatesEnabled,
  };
}

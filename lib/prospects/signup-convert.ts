import { commandDb } from "@/lib/command/prisma";
import { haltActiveFlows } from "./flow-ops";

// When someone registers, check whether their exact email is one we've been
// outreaching to. If so, mark that prospect converted, stop any active outreach
// flow (so we don't keep cold-emailing a customer), and record it. Best-effort:
// the caller wraps this so it can never fail a signup. Exact-email match only,
// so a stray match is very unlikely (we emailed that precise address).
export async function convertProspectFromSignup(
  email: string,
  agencyId: string,
): Promise<{ matched: boolean; prospectId?: string; agencyName?: string | null }> {
  const e = email.trim().toLowerCase();
  if (!e) return { matched: false };

  const contact = await commandDb.prospectContact.findFirst({
    where: {
      email: { equals: e, mode: "insensitive" },
      prospectId: { not: null },
      prospect: { convertedAgencyId: null },
    },
    select: { prospectId: true, prospect: { select: { agencyName: true } } },
  });
  if (!contact?.prospectId) return { matched: false };

  const prospectId = contact.prospectId;
  await commandDb.prospect.update({
    where: { id: prospectId },
    data: { convertedAgencyId: agencyId, convertedAt: new Date(), status: "active", nextFollowUpAt: null },
  });
  const ag = await commandDb.agency.findUnique({ where: { id: agencyId }, select: { signupSource: true } });
  if (ag && !ag.signupSource) {
    await commandDb.agency.update({ where: { id: agencyId }, data: { signupSource: "prospect:outreach" } }).catch(() => {});
  }
  await haltActiveFlows(prospectId, "signed_up").catch(() => {});
  await commandDb.prospectActivity.create({
    data: {
      prospectId,
      type: "converted",
      summary: "Signed up on their own. Outreach flow stopped.",
      metadata: { agencyId, via: "signup" },
    },
  }).catch(() => {});

  return { matched: true, prospectId, agencyName: contact.prospect?.agencyName ?? null };
}

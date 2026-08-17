// Central resolver for the outbound sender of an agency's correspondence.
//
// Every email we send on an agency's behalf (to solicitors, agents, or
// buyers/sellers) should go out FROM that agency's authenticated sending
// address, with Reply-To matching it — so replies land with the agency and the
// email is recognisably theirs. The authenticated address lives on
// Agency.quoteSenderEmail (verified in SendGrid). When an agency has no
// authenticated address, we fall back to the Sales Progressor default.
//
// This is the single source of truth for "who does this email come from".
// Prefer it over ad-hoc agencyFrom(name) (which only relabels the SP address)
// and over resolveSenderForTransaction (per-user verified email) for anything
// that represents agency correspondence.

import { prisma } from "@/lib/prisma";
import { buildFrom, stripAgencyLegalSuffix } from "@/lib/email/from-name";

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";
const SP_REPLY_TO = "updates@thesalesprogressor.co.uk";

export type ResolvedSender = { from: string; replyTo: string };

/**
 * Resolve the From/Reply-To for an agency's outbound email.
 *
 * @param agencyId the agency the email is sent on behalf of (null → SP fallback)
 * @param opts.personFirstName when set, brands the display name as
 *   "{first} at {Agency}" (client-facing tone) instead of just "{Agency}"
 */
export async function resolveAgencySender(
  agencyId: string | null | undefined,
  opts?: { personFirstName?: string },
): Promise<ResolvedSender> {
  if (agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true, quoteSenderEmail: true },
    });
    if (agency?.quoteSenderEmail) {
      const brand = stripAgencyLegalSuffix(agency.name);
      const display = opts?.personFirstName ? `${opts.personFirstName} at ${brand}` : brand;
      return { from: buildFrom(display, agency.quoteSenderEmail), replyTo: agency.quoteSenderEmail };
    }
  }
  return { from: SP_FROM, replyTo: SP_REPLY_TO };
}

/**
 * The canonical per-file outbound sender, keyed by transaction.
 *
 * 1. If the agency has its own authenticated address (quoteSenderEmail), send
 *    from it, branded "{progressor/agent first name} at {Agency}".
 * 2. If not, fall back by how the file is run (founder decision 2026-08-17):
 *    - OUTSOURCED (we progress it): the assigned progressor's own
 *      @thesalesprogressor.co.uk address (whichever progressor is on the file).
 *      If somehow no progressor is assigned, the generic updates@ inbox.
 *    - SELF-MANAGED / in-house (the agency runs it): the generic updates@ inbox.
 *
 * Reply-To always matches the sending address.
 */
export async function resolveAgencySenderForTransaction(transactionId: string): Promise<ResolvedSender> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      agencyId: true,
      serviceType: true,
      agency: { select: { quoteSenderEmail: true } },
      assignedUser: { select: { name: true, email: true } },
      agentUser: { select: { name: true } },
    },
  });
  if (!tx) return resolveAgencySender(null);

  // 1) Agency's own authenticated address.
  if (tx.agency?.quoteSenderEmail) {
    const persona = tx.serviceType === "self_managed" ? tx.agentUser?.name : tx.assignedUser?.name;
    return resolveAgencySender(
      tx.agencyId,
      persona ? { personFirstName: persona.trim().split(/\s+/)[0] } : undefined,
    );
  }

  // 2) Fallback, by how the file is run.
  if (tx.serviceType === "outsourced" && tx.assignedUser?.email) {
    return {
      from: buildFrom(tx.assignedUser.name ?? "Sales Progressor", tx.assignedUser.email),
      replyTo: tx.assignedUser.email,
    };
  }
  return resolveAgencySender(null); // in-house (or outsourced w/o progressor) -> updates@
}

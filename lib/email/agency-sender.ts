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
import { extractFirstName } from "@/lib/contacts/displayName";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";
const SP_REPLY_TO = "updates@thesalesprogressor.co.uk";
// Unmonitored reply target for self-managed files with no agent inbox — so a
// client reply never lands with us. We never invite a reply to this address
// (canReply is false when it's used).
const SP_NOREPLY = "noreply@thesalesprogressor.co.uk";

// The Sales Progressor address a client email falls back to on an OUTSOURCED
// file when the agency has no verified sender: the assigned progressor's own
// @thesalesprogressor.co.uk address, else Ellis's as the default progressor.
const PROGRESSOR_FALLBACK = "ellis@thesalesprogressor.co.uk";
function progressorFallbackAddress(assignedEmail?: string | null): string {
  return assignedEmail && assignedEmail.toLowerCase().endsWith("@thesalesprogressor.co.uk")
    ? assignedEmail
    : PROGRESSOR_FALLBACK;
}

// Persona for a per-file client email. "personal" sends from the agent's OWN
// address (self-managed + authenticated domain only) so chases/replies/invites
// feel human; "automated" sends from the agency's verified sender for
// system-generated status updates. Callers pass the persona; the default is
// "automated". See lib/command/email-senders.ts for the per-email mapping.
export type SenderPersona = "personal" | "automated";

// logoUrl + tileColor/scale/align: the agency's own logo and how it's presented
// in the email header, when they've set one. Only populated by the
// per-transaction resolver.
// canReply: whether a client reply reaches a real, intended inbox — false only
// when a self-managed file has no agent email and we fall back to noreply. The
// "just reply to this email" line is suppressed when this is false.
export type ResolvedSender = {
  from: string;
  replyTo: string;
  canReply?: boolean;
  logoUrl?: string | null;
  tileColor?: string | null;
  scale?: LogoScale | null;
  align?: LogoAlign | null;
};

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
      select: { name: true, quoteSenderEmail: true, quoteSenderVerified: true },
    });
    if (agency?.quoteSenderEmail && agency.quoteSenderVerified) {
      const brand = stripAgencyLegalSuffix(agency.name);
      const display = opts?.personFirstName ? `${opts.personFirstName} at ${brand}` : brand;
      return { from: buildFrom(display, agency.quoteSenderEmail), replyTo: agency.quoteSenderEmail, canReply: true };
    }
  }
  return { from: SP_FROM, replyTo: SP_REPLY_TO, canReply: true };
}

/**
 * The canonical per-file outbound sender, keyed by transaction.
 *
 * Display name is ALWAYS the agency's ("{agent first name} at {Agency}"), so a
 * client never sees "Sales Progressor" as the sender. The sending address is
 * chosen so it NEVER leaves from an address SendGrid can't send (which silently
 * fails); it always lands on a verified address or a Sales Progressor fallback.
 *
 * OUTSOURCED (we run it): the agency's verified sender, else our progressor
 * address. Never a specific agent's personal inbox — you're the one running it.
 *
 * SELF-MANAGED (the agent runs it):
 *  - persona "personal" (chases, replies, invites): the agent's OWN address,
 *    but only when their whole domain is authenticated (so SendGrid will send
 *    it); otherwise it falls through to the agency sender.
 *  - persona "automated" (milestone/status updates) or the fall-through above:
 *    the agency's verified sender, reply-to preferring the agent so a client
 *    reply still reaches a human.
 *  - nothing verified: our shared updates@, agent as reply-to (else noreply so a
 *    reply never lands with us).
 *
 * "Verified" means Agency.quoteSenderVerified — stamped nightly from SendGrid
 * (authenticated domain OR verified single sender). Persona defaults to
 * "automated"; callers opt into "personal".
 */
export async function resolveAgencySenderForTransaction(
  transactionId: string,
  opts?: { persona?: SenderPersona },
): Promise<ResolvedSender> {
  const persona = opts?.persona ?? "automated";
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      agencyId: true,
      serviceType: true,
      agency: {
        select: {
          name: true, quoteSenderEmail: true, quoteSenderVerified: true,
          logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true,
        },
      },
      agentUser: { select: { name: true, email: true } },
      assignedUser: { select: { email: true } },
    },
  });
  if (!tx) return resolveAgencySender(null);

  const acting = tx.agentUser;
  const firstName = acting?.name?.trim() ? extractFirstName(acting.name) : undefined;
  const brand = tx.agency?.name ? stripAgencyLegalSuffix(tx.agency.name) : null;
  const display = brand ? (firstName ? `${firstName} at ${brand}` : brand) : "Sales Progressor";
  const logo = {
    logoUrl: getAgencyLogoUrl(tx.agency?.logoPath),
    tileColor: tx.agency?.logoTileColor ?? null,
    scale: (tx.agency?.logoScale as LogoScale | null) ?? null,
    align: (tx.agency?.logoAlign as LogoAlign | null) ?? null,
  };

  const agencyAddr = tx.agency?.quoteSenderEmail ?? null;
  const agencyVerified = !!tx.agency?.quoteSenderVerified;
  const actingEmail = acting?.email ?? null;

  // ── Outsourced: the client sees the agency, never a specific agent's personal
  // inbox (we run it). Agency verified sender, else our progressor address.
  if (tx.serviceType === "outsourced") {
    if (agencyAddr && agencyVerified) {
      return { from: buildFrom(display, agencyAddr), replyTo: agencyAddr, canReply: true, ...logo };
    }
    const prog = progressorFallbackAddress(tx.assignedUser?.email);
    return { from: buildFrom(display, prog), replyTo: prog, canReply: true, ...logo };
  }

  // ── Self-managed, persona "personal": the agent's own address, but only when
  // their whole domain is authenticated (so SendGrid will actually send it).
  if (persona === "personal" && actingEmail) {
    const actingDomain = actingEmail.split("@")[1]?.toLowerCase();
    if (actingDomain) {
      const authed = await prisma.verifiedDomain.findFirst({
        where: { agencyId: tx.agencyId ?? undefined, domain: actingDomain, status: "verified" },
        select: { id: true },
      });
      if (authed) {
        return { from: buildFrom(display, actingEmail), replyTo: actingEmail, canReply: true, ...logo };
      }
    }
  }

  // ── Self-managed, automated (or a personal email whose domain isn't
  // authenticated): the agency's verified sender. Reply-to prefers the agent so
  // a client reply still reaches a human.
  if (agencyAddr && agencyVerified) {
    return { from: buildFrom(display, agencyAddr), replyTo: actingEmail ?? agencyAddr, canReply: true, ...logo };
  }

  // ── Nothing verified — our shared updates@ underneath an agency-branded
  // display; agent as reply-to, else noreply so a reply never lands with us.
  const replyTo = actingEmail ?? SP_NOREPLY;
  return {
    from: buildFrom(display, SP_REPLY_TO),
    replyTo,
    canReply: replyTo !== SP_NOREPLY,
    ...logo,
  };
}

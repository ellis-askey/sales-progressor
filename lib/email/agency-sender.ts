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
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";
const SP_REPLY_TO = "updates@thesalesprogressor.co.uk";
// Unmonitored reply target for self-managed files with no agent inbox — so a
// client reply never lands with us. We never invite a reply to this address
// (canReply is false when it's used).
const SP_NOREPLY = "noreply@thesalesprogressor.co.uk";

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
      select: { name: true, quoteSenderEmail: true },
    });
    if (agency?.quoteSenderEmail) {
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
 * client never sees "Sales Progressor" as the sender. What varies is the actual
 * sending address + reply-to:
 *
 * 1. Agency verified its own domain (quoteSenderEmail = updates@theirdomain):
 *    - if the acting agent's own email is ON that domain, send from THEIR
 *      address (the SP per-person model); otherwise the agency's updates@.
 * 2. Not yet set up:
 *    - OUTSOURCED (we run it): the assigned progressor's own
 *      @thesalesprogressor.co.uk address.
 *    - SELF-MANAGED (Option C): agency-branded display + the agent's own email
 *      as reply-to, sent on our shared updates@ address until they verify a
 *      domain. Hides everything SP-related except the actual sending address,
 *      which the domain step later cleans up.
 *
 * Reply-To matches the sending address, except in the Option C case where it's
 * the agent's own inbox so replies reach the agency, not us.
 */
export async function resolveAgencySenderForTransaction(transactionId: string): Promise<ResolvedSender> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      agencyId: true,
      serviceType: true,
      agency: {
        select: {
          name: true, quoteSenderEmail: true,
          logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true,
        },
      },
      agentUser: { select: { name: true, email: true } },
    },
  });
  if (!tx) return resolveAgencySender(null);

  // The client-facing sender is ALWAYS the agency's own agent — even on
  // outsourced files, where our progressor runs the file but stays invisible to
  // the client (Ellis, 2026-08-26). Reply-to is the agent's own email (the one
  // they gave us, e.g. ellis@akeman-residential.co.uk); the sending address is
  // their verified domain when set, otherwise our shared updates@ fallback.
  const acting = tx.agentUser;
  const firstName = acting?.name?.trim().split(/\s+/)[0] || undefined;
  const brand = tx.agency?.name ? stripAgencyLegalSuffix(tx.agency.name) : null;
  const display = brand ? (firstName ? `${firstName} at ${brand}` : brand) : "Sales Progressor";
  const logo = {
    logoUrl: getAgencyLogoUrl(tx.agency?.logoPath),
    tileColor: tx.agency?.logoTileColor ?? null,
    scale: (tx.agency?.logoScale as LogoScale | null) ?? null,
    align: (tx.agency?.logoAlign as LogoAlign | null) ?? null,
  };

  // 1) Agency's own verified domain.
  if (tx.agency?.quoteSenderEmail) {
    const verifiedDomain = tx.agency.quoteSenderEmail.split("@")[1]?.toLowerCase();
    const actingDomain = acting?.email?.split("@")[1]?.toLowerCase();
    // Per-person: acting agent's own address when it's on the verified domain.
    const addr = acting?.email && actingDomain && actingDomain === verifiedDomain
      ? acting.email
      : tx.agency.quoteSenderEmail;
    return { from: buildFrom(display, addr), replyTo: addr, canReply: true, ...logo };
  }

  // 2) Not yet verified — agency-branded display, the agent's own email as
  // reply-to, our shared updates@ address underneath (Option C, all files).
  // Self-managed with no agent inbox falls back to noreply, NEVER to us;
  // outsourced falls back to us, since we run the file.
  const replyTo = acting?.email ?? (tx.serviceType === "self_managed" ? SP_NOREPLY : SP_REPLY_TO);
  return {
    from: buildFrom(display, SP_REPLY_TO),
    replyTo,
    canReply: replyTo !== SP_NOREPLY,
    ...logo,
  };
}

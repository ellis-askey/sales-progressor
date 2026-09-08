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
import { resolveEmailTheme, type EmailTheme, type EmailThemeInput } from "@/lib/email/brand-theme";
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
  // Resolved client-email brand theme (agency colours; coral default). Only
  // populated by the per-transaction resolver.
  theme?: EmailTheme;
};

/**
 * Resolve the From/Reply-To for an agency's outbound email.
 *
 * @param agencyId the agency the email is sent on behalf of (null → SP fallback)
 * @param opts.personFirstName when set, brands the display name as
 *   "{first} at {Agency}" (client-facing tone) instead of just "{Agency}"
 * @param opts.fromPlatformAddress for AGENCY-INTERNAL notifications (morning
 *   digest, weekly brief, team invites, chain-bounce) that go to the agency's
 *   OWN staff: keep the agency's name in the display but send from our own
 *   updates@thesalesprogressor.co.uk address — never the agency's outsourced
 *   sender (quoteSenderEmail), which is only for progressing their files.
 */
export async function resolveAgencySender(
  agencyId: string | null | undefined,
  opts?: { personFirstName?: string; fromPlatformAddress?: boolean },
): Promise<ResolvedSender> {
  const agency = agencyId
    ? await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { name: true, quoteSenderEmail: true, quoteSenderVerified: true },
      })
    : null;
  const brand = agency ? stripAgencyLegalSuffix(agency.name) : null;
  const display = brand ? (opts?.personFirstName ? `${opts.personFirstName} at ${brand}` : brand) : null;

  // Agency-internal notification: keep the agency's name (when we have it) but
  // send from our own address, never their outsourced sender.
  if (opts?.fromPlatformAddress) {
    return display
      ? { from: buildFrom(display, SP_REPLY_TO), replyTo: SP_REPLY_TO, canReply: true }
      : { from: SP_FROM, replyTo: SP_REPLY_TO, canReply: true };
  }

  // Otherwise (e.g. chain invite): the agency's verified sender if it can
  // actually send, else the Sales Progressor fallback.
  if (agency?.quoteSenderEmail && agency.quoteSenderVerified && display) {
    return { from: buildFrom(display, agency.quoteSenderEmail), replyTo: agency.quoteSenderEmail, canReply: true };
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
          emailTheme: true,
        },
      },
      agentUser: { select: { name: true, email: true } },
      assignedUser: { select: { email: true, name: true } },
    },
  });
  if (!tx) return resolveAgencySender(null);

  const acting = tx.agentUser;
  // Whose name brands the email ("{first} at {Agency}"): on OUTSOURCED files WE
  // run it, so it's the assigned PROGRESSOR (e.g. "Ellis at VIA Properties"); on
  // SELF-MANAGED files the AGENT runs their own, so it's the agent. (Was always
  // using the agent's name, which mis-branded outsourced files.)
  const brandPerson = tx.serviceType === "outsourced" ? tx.assignedUser : tx.agentUser;
  const firstName = brandPerson?.name?.trim() ? extractFirstName(brandPerson.name) : undefined;
  const brand = tx.agency?.name ? stripAgencyLegalSuffix(tx.agency.name) : null;
  const display = brand ? (firstName ? `${firstName} at ${brand}` : brand) : "Sales Progressor";
  const theme = resolveEmailTheme((tx.agency?.emailTheme ?? null) as EmailThemeInput | null);
  const logo = {
    logoUrl: getAgencyLogoUrl(tx.agency?.logoPath),
    tileColor: tx.agency?.logoTileColor ?? null,
    scale: (tx.agency?.logoScale as LogoScale | null) ?? null,
    align: (tx.agency?.logoAlign as LogoAlign | null) ?? null,
    theme,
  };

  const agencyAddr = tx.agency?.quoteSenderEmail ?? null;
  const agencyVerified = !!tx.agency?.quoteSenderVerified;
  const actingEmail = acting?.email ?? null;

  // ── Outsourced: the client sees the agency (From = agency verified sender for
  // branding), but WE run the file. Reply-to goes to the agency's own address
  // ONLY when that address is a real inbox we can read — a verified SINGLE
  // SENDER (someone confirmed a link sent to it, e.g. ellis@viavia.co.uk). A
  // DOMAIN-authenticated sender (e.g. updates@theirdomain) is send-only and not
  // ours, so replies there would vanish — those go to the assigned progressor.
  // Distinguisher: a domain-auth sender has a *verified* VerifiedDomain for its
  // domain; a single sender does not.
  // NOTE: while one progressor handles everything this is ideal; when files are
  // split across progressors, single-sender replies still land in the shared
  // agency inbox rather than the assigned person's — revisit then.
  if (tx.serviceType === "outsourced") {
    const prog = progressorFallbackAddress(tx.assignedUser?.email);
    if (agencyAddr && agencyVerified) {
      const senderDomain = agencyAddr.split("@")[1]?.toLowerCase();
      const domainAuthed = senderDomain
        ? !!(await prisma.verifiedDomain.findFirst({
            where: { agencyId: tx.agencyId ?? undefined, domain: senderDomain, status: "verified" },
            select: { id: true },
          }))
        : false;
      const replyTo = domainAuthed ? prog : agencyAddr;
      return { from: buildFrom(display, agencyAddr), replyTo, canReply: true, ...logo };
    }
    return { from: buildFrom(display, prog), replyTo: prog, canReply: true, ...logo };
  }

  // ── Self-managed: the agent runs their own file, so the sender is THEIR own
  // identity — NEVER the agency's outsourced sender. quoteSenderEmail (e.g.
  // ellis@viavia.co.uk) is the address the agency gave us to progress on their
  // behalf; it has no place on a file they run themselves. When their own domain
  // is authenticated in SendGrid:
  //   personal  → their own login address           (e.g. danny@dannybaileyproperty.co.uk)
  //   automated → the generic mailbox on their domain (e.g. updates@dannybaileyproperty.co.uk)
  // Reply-to is always their own login address.
  const actingDomain = actingEmail?.split("@")[1]?.toLowerCase();
  if (actingEmail && actingDomain) {
    const authed = await prisma.verifiedDomain.findFirst({
      where: { agencyId: tx.agencyId ?? undefined, domain: actingDomain, status: "verified" },
      select: { id: true },
    });
    if (authed) {
      const from = persona === "personal" ? actingEmail : `updates@${actingDomain}`;
      return { from: buildFrom(display, from), replyTo: actingEmail, canReply: true, ...logo };
    }
  }

  // ── Their domain isn't authenticated — everything sends from our shared
  // updates@thesalesprogressor.co.uk, reply-to their own login address so
  // replies reach them (noreply only if there's somehow no agent email on file).
  const replyTo = actingEmail ?? SP_NOREPLY;
  return {
    from: buildFrom(display, SP_REPLY_TO),
    replyTo,
    canReply: replyTo !== SP_NOREPLY,
    ...logo,
  };
}

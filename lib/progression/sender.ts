// The verified WHITE-LABEL sending address for an OUTSOURCED (external progression
// business) file — resolved so that two progression companies at the same agency
// NEVER share one sending identity (which would merge two separate businesses'
// correspondence into one inbox / one From address).
//
// Resolution order:
//   1. The per-(company, agency) sender — the address the agency provisions THIS
//      company on its own domain (ProgressionBusinessClient.senderEmail), verified.
//   2. The agency's own verified sender (Agency.quoteSenderEmail) — ONLY when the
//      agency has a SINGLE active progressor, so it unambiguously belongs to them.
//      (A multi-progressor agency's shared address can't be attributed to one
//      company, so it is never used — each company must be provisioned its own.)
//   3. The company's OWN verified sender (its own domain, ProgressionBusiness.senderEmail).
//
// Returns null when none is set up. The caller then falls back to the platform
// address for the From line (updates@thesalesprogressor.co.uk — deliverability only,
// we can't send from an unverified address) and to the assigned progressor's own
// inbox for Reply-To / the client-facing contact (never the platform address).

import { prisma } from "@/lib/prisma";

export type WhiteLabelSenderInput = {
  agencyId: string;
  progressionBusinessId: string | null;
  // Agency-level sender (quoteSenderEmail + quoteSenderVerified).
  agencyQuoteSenderEmail: string | null;
  agencyQuoteSenderVerified: boolean;
  // The responsible progression business's OWN verified sender (its own domain).
  business: { senderEmail: string | null; senderVerified: boolean; isTsp: boolean } | null;
};

export async function resolveOutsourcedWhiteLabelSender(
  input: WhiteLabelSenderInput,
): Promise<string | null> {
  const { agencyId, progressionBusinessId, agencyQuoteSenderEmail, agencyQuoteSenderVerified, business } = input;

  // 1. Per-(company, agency) sender — the proper per-company identity.
  if (progressionBusinessId) {
    const link = await prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId, agencyId } },
      select: { senderEmail: true, senderVerified: true },
    });
    if (link?.senderVerified && link.senderEmail?.trim()) return link.senderEmail.trim();
  }

  // 2. Agency's own verified sender — only when there's a single active progressor
  // (no ambiguity, so no merge risk). Preserves every single-progressor setup.
  if (agencyQuoteSenderEmail?.trim() && agencyQuoteSenderVerified) {
    const activeProgressors = await prisma.progressionBusinessClient.count({
      where: { agencyId, removedAt: null },
    });
    if (activeProgressors <= 1) return agencyQuoteSenderEmail.trim();
  }

  // 3. The company's own verified sender (its own domain).
  if (business && !business.isTsp && business.senderVerified && business.senderEmail?.trim()) {
    return business.senderEmail.trim();
  }

  return null;
}

// ─── The full client-facing sender ladder (founder-approved 2026-10-21) ──────
// See docs/active/progression-sender-ladder/PLAN.md. A progression company's
// own domain must never face buyers/sellers/solicitors/brokers — not From, not
// Reply-To, not the footer — while every client reply still reaches the
// progressor's real inbox AND is filed on the sale.
//
//   1. Provisioned per-(company, agency) sender      → From = Reply-To = it
//   2. Agency's verified sender (single progressor)  → From = Reply-To = it
//   3. Minted on the agency's authenticated domain:
//      a. inbound subdomain delegated to us → {first}@progression.{domain},
//         From = Reply-To (everything to it reaches our webhook: filed + forwarded)
//      b. domain auth only → From {first}.updates@{domain}, Reply-To = the
//         per-file capture alias (filed on the sale + forwarded to the
//         progressor by the sendgrid-inbound webhook)
//   4. Nothing verified → From updates@thesalesprogressor.co.uk, Reply-To = the
//      per-file capture alias. The progressor's login email is Reply-To ONLY
//      when REPLY_CAPTURE_DOMAIN is unset (environment regression safety).
//
// NOTE the deliberate change from resolveOutsourcedWhiteLabelSender's old tier
// 3: the business's OWN domain (e.g. keytocompletion.co.uk) is for AGENT-facing
// email only and never enters this ladder.

import { resolveReplyCaptureAddress } from "@/lib/email/reply-capture";

const SP_FALLBACK = "updates@thesalesprogressor.co.uk";

export type OutsourcedClientSender = {
  from: string; // bare address for the From line (display name is the caller's)
  replyTo: string;
  // The address footers/contact lines may PRINT — always the branded From,
  // never a capture alias and never the progressor's login email.
  visibleEmail: string;
  tier: 1 | 2 | 3 | 4;
};

// "Jo Saunders" → "jo"; clash at the agency → "jo.s". Pure; exported for tests.
export function mintedLocalPart(name: string | null | undefined, clash: boolean): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = slug(parts[0] ?? "") || "progression";
  if (!clash) return first;
  const surname = slug(parts[parts.length - 1] ?? "");
  return surname && parts.length > 1 ? `${first}.${surname[0]}` : first;
}

// Does another ACTIVE progression company at this agency have a member with
// the same first name? Drives the surname-initial suffix so two companies'
// minted addresses can never collide.
async function firstNameClashes(
  agencyId: string,
  progressionBusinessId: string | null,
  firstLocal: string,
): Promise<boolean> {
  const links = await prisma.progressionBusinessClient.findMany({
    where: { agencyId, removedAt: null },
    select: { progressionBusinessId: true },
  });
  const otherBizIds = links
    .map((l) => l.progressionBusinessId)
    .filter((id) => id !== progressionBusinessId);
  if (!otherBizIds.length) return false;
  const others = await prisma.user.findMany({
    where: { progressionBusinessId: { in: otherBizIds } },
    select: { name: true },
  });
  return others.some((u) => mintedLocalPart(u.name, false) === firstLocal);
}

export async function resolveOutsourcedClientSender(input: {
  transactionId: string;
  agencyId: string;
  progressionBusinessId: string | null;
  agencyQuoteSenderEmail: string | null;
  agencyQuoteSenderVerified: boolean;
  assignedUser: { name: string | null; email: string | null } | null;
}): Promise<OutsourcedClientSender> {
  // Tiers 1 + 2 (business deliberately excluded — its own domain never faces clients).
  const provisioned = await resolveOutsourcedWhiteLabelSender({
    agencyId: input.agencyId,
    progressionBusinessId: input.progressionBusinessId,
    agencyQuoteSenderEmail: input.agencyQuoteSenderEmail,
    agencyQuoteSenderVerified: input.agencyQuoteSenderVerified,
    business: null,
  });
  if (provisioned) {
    // Distinguish 1 vs 2 only for reporting; behaviour is identical.
    const link = input.progressionBusinessId
      ? await prisma.progressionBusinessClient.findUnique({
          where: {
            progressionBusinessId_agencyId: {
              progressionBusinessId: input.progressionBusinessId,
              agencyId: input.agencyId,
            },
          },
          select: { senderEmail: true, senderVerified: true },
        })
      : null;
    const tier = link?.senderVerified && link.senderEmail?.trim() === provisioned ? 1 : 2;
    return { from: provisioned, replyTo: provisioned, visibleEmail: provisioned, tier };
  }

  // Tier 3: the agency's authenticated domain.
  const domain = await prisma.verifiedDomain.findFirst({
    where: { agencyId: input.agencyId, status: "verified" },
    select: { domain: true },
  });
  const capture = await resolveReplyCaptureAddress(input.transactionId);
  // Login email is the LAST resort only — the environment-regression case.
  const forwardFallback = input.assignedUser?.email ?? SP_FALLBACK;

  if (domain) {
    const first = mintedLocalPart(input.assignedUser?.name, false);
    const clash = await firstNameClashes(input.agencyId, input.progressionBusinessId, first);
    const local = mintedLocalPart(input.assignedUser?.name, clash);
    const from = `${local}.updates@${domain.domain.toLowerCase()}`;
    return { from, replyTo: capture ?? forwardFallback, visibleEmail: from, tier: 3 };
  }

  // Tier 4: platform address + capture.
  return {
    from: SP_FALLBACK,
    replyTo: capture ?? forwardFallback,
    visibleEmail: SP_FALLBACK,
    tier: 4,
  };
}

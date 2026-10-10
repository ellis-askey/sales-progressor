import { prisma } from "@/lib/prisma";
import { createHash, createHmac, randomBytes } from "crypto";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildEmailVerification } from "@/lib/emails/email-verification";
import {
  createSingleSender,
  findSingleSenderByEmail,
  resendSingleSenderVerification,
  isSingleSenderVerified,
} from "@/lib/services/sendgrid";

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "proton.me", "btinternet.com", "sky.com", "talktalk.net",
]);

export function isPersonalDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? PERSONAL_DOMAINS.has(domain) : true;
}

export function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * How a set sending address was set up, for the Sending-address card's resting
 * state + replies wording. A verified domain matching the address's domain →
 * "domain" (send-only, replies route to the progressor). Any other set address →
 * "single" (a real mailbox, replies land in it). Null when nothing is set up.
 */
export function senderMethod(
  senderEmail: string | null,
  domain: { domain: string; status: string } | null,
): "domain" | "single" | null {
  if (!senderEmail) return null;
  const emailDomain = senderEmail.split("@")[1]?.toLowerCase();
  const domainVerifiedMatch = !!domain && domain.status === "verified" && domain.domain.toLowerCase() === emailDomain;
  return domainVerifiedMatch ? "domain" : "single";
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function signToken(raw: string): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "secret")
    .update(raw)
    .digest("hex");
}

/** Generate a 6-digit numeric verification code */
function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Generate a random one-click token + its HMAC signature for URL use */
function makeToken(): { raw: string; signed: string } {
  const raw = randomBytes(24).toString("hex");
  return { raw, signed: signToken(raw) };
}

// ─── Domain queries ──────────────────────────────────────────────────────────

export async function getVerifiedDomainForAgency(agencyId: string, domain: string) {
  return prisma.verifiedDomain.findUnique({
    where: { agencyId_domain: { agencyId, domain } },
  });
}

export async function listVerifiedDomainsForAgency(agencyId: string) {
  return prisma.verifiedDomain.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The link that makes a verified domain actually drive outbound sender
 * resolution: when an agency's domain becomes verified, adopt updates@<domain>
 * as the agency's sending address (Agency.quoteSenderEmail). Only fills a blank
 * — never overrides an address the agency already has. Idempotent; safe to call
 * from every verify path (founder, self-serve, nightly recheck).
 */
export async function adoptVerifiedDomainAsAgencySender(agencyId: string, domain: string): Promise<void> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { quoteSenderEmail: true },
  });
  if (!agency || agency.quoteSenderEmail) return;
  await prisma.agency.update({
    where: { id: agencyId },
    data: { quoteSenderEmail: `updates@${domain.toLowerCase()}` },
  });
}

// ─── Domain queries — external progression business (its OWN default sender) ────
// Mirror the agency queries but keyed on progressionBusinessId. The business is
// the OTHER owner a VerifiedDomain can have (polymorphic). Used to set up a
// progression business's own default sending domain (the tier beneath a client
// agency's own verified sender in resolveAgencySenderForTransaction).

export async function getVerifiedDomainForBusiness(businessId: string, domain: string) {
  return prisma.verifiedDomain.findUnique({
    where: { progressionBusinessId_domain: { progressionBusinessId: businessId, domain } },
  });
}

export async function listVerifiedDomainsForBusiness(businessId: string) {
  return prisma.verifiedDomain.findMany({
    where: { progressionBusinessId: businessId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Business sibling of adoptVerifiedDomainAsAgencySender: when a progression
 * business's own domain becomes verified, adopt updates@<domain> as its sending
 * address (ProgressionBusiness.senderEmail + senderDomain). Only fills blanks —
 * never overrides. senderVerified itself is stamped by the check-domains cron
 * (mirrors how Agency.quoteSenderVerified is stamped). Idempotent.
 */
export async function adoptVerifiedDomainAsBusinessSender(businessId: string, domain: string): Promise<void> {
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { senderEmail: true, senderDomain: true },
  });
  if (!business || business.senderEmail) return;
  const d = domain.toLowerCase();
  await prisma.progressionBusiness.update({
    where: { id: businessId },
    data: { senderEmail: `updates@${d}`, senderDomain: d },
  });
}

// ─── Single-sender (no-DNS "mailbox" path) ────────────────────────────────────
// The agency has given the progressor a real mailbox on their domain (e.g.
// you@theiragency.co.uk). We verify that ONE address via SendGrid Single Sender
// Verification (a link emailed to it) — no DNS. On create we store it as the
// sending address, UNVERIFIED; the nightly check-domains cron flips the verified
// flag once SendGrid confirms it, and the "check" action below does the same
// immediately. No VerifiedDomain exists for it, so the sender resolver keeps
// reply-to on the address itself (replies land in that inbox).

/** Start single-sender verification for a CLIENT agency. Owner-scoped by caller. */
export async function startAgencySingleSender(agencyId: string, email: string, fromName: string): Promise<{ ok: true } | { error: string }> {
  const clean = email.trim().toLowerCase();
  if (isPersonalDomain(clean)) return { error: "Use an address on the agency's own domain, not a personal account like Gmail or Outlook." };
  if (!extractDomain(clean)) return { error: "That doesn't look like a valid email address." };
  try {
    await createSingleSender({ fromEmail: clean, fromName, replyTo: clean });
  } catch {
    return { error: "We couldn't start verification for that address. Check it's correct and try again." };
  }
  await prisma.agency.update({
    where: { id: agencyId },
    data: { quoteSenderEmail: clean, quoteSenderVerified: false, quoteSenderVerifiedAt: null },
  });
  return { ok: true };
}

/** Check + adopt a CLIENT agency's pending single sender. Returns whether it's verified. */
export async function checkAgencySingleSender(agencyId: string): Promise<{ verified: boolean }> {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { quoteSenderEmail: true } });
  if (!agency?.quoteSenderEmail) return { verified: false };
  const verified = await isSingleSenderVerified(agency.quoteSenderEmail);
  if (verified) {
    await prisma.agency.update({ where: { id: agencyId }, data: { quoteSenderVerified: true, quoteSenderVerifiedAt: new Date() } });
  }
  return { verified };
}

/** Re-send the verification email for a CLIENT agency's pending single sender. */
export async function resendAgencySingleSender(agencyId: string): Promise<{ ok: true } | { error: string }> {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { quoteSenderEmail: true } });
  if (!agency?.quoteSenderEmail) return { error: "There's no address to resend to." };
  const info = await findSingleSenderByEmail(agency.quoteSenderEmail);
  if (!info) return { error: "We couldn't find that verification. Try entering the address again." };
  try { await resendSingleSenderVerification(info.id); } catch { return { error: "We couldn't resend just now. Try again shortly." }; }
  return { ok: true };
}

/** Start single-sender verification for a PROGRESSION BUSINESS's own default sender. */
export async function startBusinessSingleSender(businessId: string, email: string, fromName: string): Promise<{ ok: true } | { error: string }> {
  const clean = email.trim().toLowerCase();
  if (isPersonalDomain(clean)) return { error: "Use an address on your business's own domain, not a personal account like Gmail or Outlook." };
  const domain = extractDomain(clean);
  if (!domain) return { error: "That doesn't look like a valid email address." };
  try {
    await createSingleSender({ fromEmail: clean, fromName, replyTo: clean });
  } catch {
    return { error: "We couldn't start verification for that address. Check it's correct and try again." };
  }
  await prisma.progressionBusiness.update({
    where: { id: businessId },
    data: { senderEmail: clean, senderDomain: domain, senderVerified: false, senderVerifiedAt: null },
  });
  return { ok: true };
}

/** Check + adopt a PROGRESSION BUSINESS's pending single sender. */
export async function checkBusinessSingleSender(businessId: string): Promise<{ verified: boolean }> {
  const business = await prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { senderEmail: true } });
  if (!business?.senderEmail) return { verified: false };
  const verified = await isSingleSenderVerified(business.senderEmail);
  if (verified) {
    await prisma.progressionBusiness.update({ where: { id: businessId }, data: { senderVerified: true, senderVerifiedAt: new Date() } });
  }
  return { verified };
}

/** Re-send the verification email for a PROGRESSION BUSINESS's pending single sender. */
export async function resendBusinessSingleSender(businessId: string): Promise<{ ok: true } | { error: string }> {
  const business = await prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { senderEmail: true } });
  if (!business?.senderEmail) return { error: "There's no address to resend to." };
  const info = await findSingleSenderByEmail(business.senderEmail);
  if (!info) return { error: "We couldn't find that verification. Try entering the address again." };
  try { await resendSingleSenderVerification(info.id); } catch { return { error: "We couldn't resend just now. Try again shortly." }; }
  return { ok: true };
}

// ─── User email queries ───────────────────────────────────────────────────────

export async function listVerifiedEmailsForUser(userId: string) {
  return prisma.userVerifiedEmail.findMany({
    where: { userId, status: { not: "revoked" } },
    include: { verifiedDomain: { select: { domain: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getVerifiedEmailForSending(userId: string, email: string) {
  return prisma.userVerifiedEmail.findUnique({
    where: { userId_email: { userId, email } },
    include: { verifiedDomain: true },
  });
}

// ─── Inbox verification ───────────────────────────────────────────────────────

export async function startInboxVerification(
  userId: string,
  email: string,
  verifiedDomainId: string,
  baseUrl: string
): Promise<{ ok: true } | { error: string }> {
  const code = makeCode();
  const { raw: tokenRaw, signed: tokenSigned } = makeToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.userVerifiedEmail.upsert({
    where: { userId_email: { userId, email } },
    update: {
      status: "pending_inbox_check",
      verificationCodeHash: hashCode(code),
      verificationToken: tokenSigned,
      verificationExpiresAt: expiresAt,
      verifiedAt: null,
    },
    create: {
      userId,
      email,
      verifiedDomainId,
      status: "pending_inbox_check",
      verificationCodeHash: hashCode(code),
      verificationToken: tokenSigned,
      verificationExpiresAt: expiresAt,
    },
  });

  const verifyLink = `${baseUrl}/api/agent/verified-emails/inbox/verify-link?token=${tokenRaw}&email=${encodeURIComponent(email)}&userId=${userId}`;

  const built = buildEmailVerification({ email, code, verifyUrl: verifyLink });
  await sendAgentEmail({
    to: email,
    kind: "verified_email",
    userId,
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: "support@thesalesprogressor.co.uk",
  });

  return { ok: true };
}

export async function confirmInboxCode(
  userId: string,
  email: string,
  code: string
): Promise<{ ok: true } | { error: string }> {
  const record = await prisma.userVerifiedEmail.findUnique({
    where: { userId_email: { userId, email } },
  });

  if (!record) return { error: "No pending verification found" };
  if (record.status === "verified") return { ok: true };
  if (!record.verificationExpiresAt || record.verificationExpiresAt < new Date()) {
    return { error: "Verification code has expired" };
  }
  if (record.verificationCodeHash !== hashCode(code.trim())) {
    return { error: "Incorrect code" };
  }

  await prisma.userVerifiedEmail.update({
    where: { userId_email: { userId, email } },
    data: {
      status: "verified",
      verifiedAt: new Date(),
      verificationCodeHash: null,
      verificationToken: null,
      verificationExpiresAt: null,
    },
  });

  return { ok: true };
}

export async function confirmInboxToken(
  userId: string,
  email: string,
  rawToken: string
): Promise<{ ok: true } | { error: string }> {
  const record = await prisma.userVerifiedEmail.findUnique({
    where: { userId_email: { userId, email } },
  });

  if (!record) return { error: "No pending verification found" };
  if (record.status === "verified") return { ok: true };
  if (!record.verificationExpiresAt || record.verificationExpiresAt < new Date()) {
    return { error: "Verification link has expired" };
  }
  if (record.verificationToken !== signToken(rawToken)) {
    return { error: "Invalid verification link" };
  }

  await prisma.userVerifiedEmail.update({
    where: { userId_email: { userId, email } },
    data: {
      status: "verified",
      verifiedAt: new Date(),
      verificationCodeHash: null,
      verificationToken: null,
      verificationExpiresAt: null,
    },
  });

  return { ok: true };
}

export async function revokeVerifiedEmail(userId: string, emailId: string) {
  await prisma.userVerifiedEmail.updateMany({
    where: { id: emailId, userId },
    data: { status: "revoked" },
  });
}

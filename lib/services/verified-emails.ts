import { prisma } from "@/lib/prisma";
import { createHash, createHmac, randomBytes } from "crypto";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildEmailVerification } from "@/lib/emails/email-verification";

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

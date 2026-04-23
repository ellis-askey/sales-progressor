import { prisma } from "@/lib/prisma";
import { createHash, createHmac, randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";

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

  await sendEmail({
    to: email,
    subject: "Verify your sending address — Sales Progressor",
    text: [
      `Your verification code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "",
      "Or click the link below to verify instantly:",
      verifyLink,
      "",
      "Once verified, you'll be able to send emails to clients from this address via the Sales Progressor dashboard.",
      "",
      "If you didn't request this, please ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;color:#1a1d29;">Verify your email address</h2>
        <p style="color:#4a5162;font-size:14px;margin-bottom:24px;">Enter this code in the Sales Progressor dashboard to verify <strong>${email}</strong>:</p>
        <div style="background:#f8f9fb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1a1d29;">${code}</span>
          <p style="color:#8b91a3;font-size:12px;margin-top:8px;margin-bottom:0;">Expires in 15 minutes</p>
        </div>
        <a href="${verifyLink}" style="display:block;background:#2563eb;color:white;text-decoration:none;padding:14px 24px;border-radius:10px;text-align:center;font-weight:600;font-size:14px;margin-bottom:24px;">Verify this email</a>
        <p style="color:#8b91a3;font-size:12px;">Once verified, you'll be able to send emails from this address via the Sales Progressor dashboard. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
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

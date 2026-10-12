import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./types";

// Boardwalk Forms session — a stateless HMAC-signed cookie, completely
// separate from NextAuth. Mirrors the in-house pattern from
// lib/command/session.ts: base64url(JSON payload) + "." + hex(HMAC-SHA256).
// The signing key is derived from NEXTAUTH_SECRET with a domain-separation
// label so a forms cookie can never be replayed against any TSP surface
// (and vice versa) even though both ultimately root in the same secret.

const COOKIE_NAME = "forms_session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 14; // 14 days

const BCRYPT_COST = 12; // matches the TSP convention (lib/auth.ts)

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return crypto.createHmac("sha256", secret).update("boardwalk-forms-session-v1").digest();
}

interface SessionPayload {
  userId: string;
  tenantId: string;
  sessionVersion: number;
  issuedAt: number;
}

function sign(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", signingKey()).update(encoded).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.userId !== "string" || typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_S * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export async function setFormsSessionCookie(user: {
  id: string;
  tenantId: string;
  sessionVersion: number;
}): Promise<void> {
  const token = sign({
    userId: user.id,
    tenantId: user.tenantId,
    sessionVersion: user.sessionVersion,
    issuedAt: Date.now(),
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearFormsSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Resolves the current Boardwalk Forms session, or null. Verifies the cookie
 * signature, then confirms the user still exists and the sessionVersion still
 * matches (bumped on password change → all other devices signed out).
 */
export async function getFormsSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;

  const user = await prisma.formTenantUser.findUnique({
    where: { id: payload.userId },
    include: { tenant: { select: { id: true, slug: true, name: true } } },
  });
  if (!user) return null;
  if (user.sessionVersion !== payload.sessionVersion) return null;
  if (user.tenantId !== payload.tenantId) return null;

  return {
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    tenantName: user.tenant.name,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Route-handler guard: returns the session or throws a 401-shaped error. */
export async function requireFormsSession(): Promise<SessionUser> {
  const session = await getFormsSession();
  if (!session) {
    const err = new Error("Not signed in") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return session;
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}

/**
 * Validates a tenant-scoped login. Returns the user row on success, null on
 * any failure (never distinguishes "no such user" from "wrong password").
 */
export async function validateLogin(tenantSlug: string, email: string, password: string) {
  const user = await prisma.formTenantUser.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      tenant: { slug: tenantSlug },
    },
    include: { tenant: { select: { slug: true } } },
  });
  if (!user) {
    // Burn comparable time so missing accounts aren't detectable by latency.
    await compare(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZK1BnIpF7YBuCADgDFbCkjCxCCjzVy");
    return null;
  }
  const valid = await compare(password, user.passwordHash);
  return valid ? user : null;
}

/** Changes a user's password and signs out every other device. */
export async function changePassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  return prisma.formTenantUser.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
}

// ─── Password reset ──────────────────────────────────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a reset token for the given email, if an account exists. Always
 * resolves (no account enumeration); returns the raw token only when a user
 * was found so the caller can email the link.
 */
export async function issueResetToken(tenantSlug: string, email: string): Promise<{ token: string; user: { id: string; email: string; name: string } } | null> {
  const user = await prisma.formTenantUser.findFirst({
    where: { email: email.toLowerCase().trim(), tenant: { slug: tenantSlug } },
  });
  if (!user) return null;
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.formTenantUser.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashResetToken(token),
      resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

/** Consumes a reset token: validates, sets the new password, invalidates sessions. */
export async function consumeResetToken(token: string, newPassword: string): Promise<boolean> {
  const user = await prisma.formTenantUser.findFirst({
    where: {
      resetTokenHash: hashResetToken(token),
      resetTokenExpiresAt: { gt: new Date() },
    },
  });
  if (!user) return false;
  await changePassword(user.id, newPassword);
  return true;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password needs to be at least 10 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password needs to include both letters and numbers.";
  }
  return null;
}

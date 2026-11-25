import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PROPOSAL_SLUG, PROPOSAL_DEFAULT_PASSWORD } from "./config";

// Private proposal session — a stateless HMAC-signed cookie, completely separate
// from NextAuth (mirrors lib/forms/auth.ts). Signing key is derived from
// NEXTAUTH_SECRET with a domain-separation label so a proposal cookie can never
// be replayed against any other TSP surface.
//
// Access control is deliberately resilient: it reads the password + session
// epoch from a ProposalAccess row when the table exists, and falls back to the
// built-in default password (2027) before the migration is applied. That means
// the gated experience works the moment the code ships; the DB simply lights up
// rotation, revocation and analytics once migrated.

const COOKIE_NAME = "proposal_session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 14; // 14 days
const BCRYPT_COST = 12;

// The agreed default password, overridable before the first login via env.
const DEFAULT_PASSWORD = process.env.PROPOSAL_DEFAULT_PASSWORD || PROPOSAL_DEFAULT_PASSWORD;

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return crypto.createHmac("sha256", secret).update("proposal-boardwalk-session-v1").digest();
}

export interface ProposalSessionPayload {
  slug: string;
  inviteId: string | null;
  /** The session-analytics row id this browsing occasion is attached to. */
  sid: string | null;
  /** Access epoch at issue time — a bump revokes every live cookie at once. */
  epoch: number;
  issuedAt: number;
}

function sign(payload: ProposalSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

function verifySignature(token: string): ProposalSessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", signingKey()).update(encoded).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProposalSessionPayload;
    if (typeof payload.issuedAt !== "number" || typeof payload.epoch !== "number") return null;
    if (Date.now() - payload.issuedAt > SESSION_MAX_AGE_S * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Access state (password + epoch + revocation) ────────────────────────────

interface AccessState {
  epoch: number;
  revoked: boolean;
  compare: (plain: string) => Promise<boolean>;
}

/** Constant-time compare for the pre-migration fallback password. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn a compare to avoid a length-based timing signal.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

const fallbackAccess: AccessState = {
  epoch: 1,
  revoked: false,
  compare: async (plain: string) => constantTimeEqual(plain, DEFAULT_PASSWORD),
};

/** Read-only access state for session verification (never writes). */
async function readAccessState(slug = PROPOSAL_SLUG): Promise<AccessState> {
  try {
    const row = await prisma.proposalAccess.findUnique({ where: { slug } });
    if (!row) return fallbackAccess;
    return {
      epoch: row.sessionEpoch,
      revoked: !!row.revokedAt,
      compare: (plain: string) => compare(plain, row.passwordHash),
    };
  } catch {
    // Table not migrated yet, or DB unreachable — fall back so the gate still works.
    return fallbackAccess;
  }
}

/**
 * Access state for an authentication attempt. Lazily seeds the ProposalAccess
 * row (hashing the default password) the first time someone signs in after the
 * migration, so there is no manual seed step.
 */
async function loadOrSeedAccessState(slug = PROPOSAL_SLUG): Promise<AccessState> {
  try {
    let row = await prisma.proposalAccess.findUnique({ where: { slug } });
    if (!row) {
      const passwordHash = await hash(DEFAULT_PASSWORD, BCRYPT_COST);
      try {
        row = await prisma.proposalAccess.create({ data: { slug, passwordHash } });
      } catch {
        // Lost a create race — re-read.
        row = await prisma.proposalAccess.findUnique({ where: { slug } });
      }
    }
    if (!row) return fallbackAccess;
    return {
      epoch: row.sessionEpoch,
      revoked: !!row.revokedAt,
      compare: (plain: string) => compare(plain, row!.passwordHash),
    };
  } catch {
    return fallbackAccess;
  }
}

export interface PasswordCheck {
  ok: boolean;
  revoked: boolean;
  epoch: number;
}

/** Verifies an entered password. Returns revoked=true if the whole proposal is off. */
export async function verifyProposalPassword(plain: string, slug = PROPOSAL_SLUG): Promise<PasswordCheck> {
  const state = await loadOrSeedAccessState(slug);
  if (state.revoked) return { ok: false, revoked: true, epoch: state.epoch };
  const ok = await state.compare(plain);
  return { ok, revoked: false, epoch: state.epoch };
}

export async function currentEpoch(slug = PROPOSAL_SLUG): Promise<number> {
  return (await readAccessState(slug)).epoch;
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export async function setProposalSessionCookie(payload: ProposalSessionPayload): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearProposalSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Resolves the current proposal session or null. Validates the cookie signature,
 * then confirms the access epoch still matches and the proposal isn't revoked.
 */
export async function getProposalSession(slug = PROPOSAL_SLUG): Promise<ProposalSessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySignature(token);
  if (!payload) return null;
  if (payload.slug !== slug) return null;

  const state = await readAccessState(slug);
  if (state.revoked) return null;
  if (payload.epoch !== state.epoch) return null;
  return payload;
}

/** True when a valid, non-revoked session is present. */
export async function hasProposalSession(slug = PROPOSAL_SLUG): Promise<boolean> {
  return (await getProposalSession(slug)) !== null;
}

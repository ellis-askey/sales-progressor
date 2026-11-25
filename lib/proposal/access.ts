import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { classifyDevice } from "@/lib/command/device";
import { PROPOSAL_SLUG, type ProposalEventKind } from "./config";

// First-party, privacy-minded analytics for the proposal microsite. Everything
// here is best-effort: a write that fails (e.g. before the migration is applied,
// or a transient DB hiccup) must never break the reader's experience. We store
// no raw IPs (only a salted hash, for brute-force counting and rough uniqueness),
// no financial inputs, and no precise geolocation — just the coarse signals the
// brief asks for.

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 10; // failed attempts per IP per window
const SESSION_GAP_MS = 30 * 60 * 1000; // a new browsing occasion after this idle gap

// In-memory fallback for brute-force counting when the DB table isn't available
// yet. Per-instance only (so weaker than the DB counter), but combined with the
// opaque-invite requirement and the password it's a reasonable pre-migration net.
const memAttempts = new Map<string, number[]>();

export function hashIp(ip: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "proposal-fallback-salt";
  return crypto.createHmac("sha256", secret).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export function clientIpFrom(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export interface RequestMeta {
  ipHash: string;
  country: string | null;
  region: string | null;
  device: string;
  browser: string;
  userAgent: string | null;
}

function classifyBrowser(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return "Other";
}

export function requestMeta(req: Request): RequestMeta {
  const ua = req.headers.get("user-agent");
  return {
    ipHash: hashIp(clientIpFrom(req)),
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    device: classifyDevice(ua),
    browser: classifyBrowser(ua),
    userAgent: ua,
  };
}

// ─── Brute-force lockout ─────────────────────────────────────────────────────

export async function recordAuthAttempt(ipHash: string, success: boolean, slug = PROPOSAL_SLUG): Promise<void> {
  try {
    await prisma.proposalAuthAttempt.create({ data: { slug, ipHash, success } });
  } catch {
    // DB unavailable — track failures in memory as a fallback.
    if (!success) {
      const now = Date.now();
      const hits = (memAttempts.get(ipHash) ?? []).filter((t) => now - t < LOCKOUT_WINDOW_MS);
      hits.push(now);
      memAttempts.set(ipHash, hits);
    }
  }
}

export async function isLockedOut(ipHash: string, slug = PROPOSAL_SLUG): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  try {
    const fails = await prisma.proposalAuthAttempt.count({
      where: { slug, ipHash, success: false, createdAt: { gte: since } },
    });
    return fails >= LOCKOUT_THRESHOLD;
  } catch {
    const now = Date.now();
    const hits = (memAttempts.get(ipHash) ?? []).filter((t) => now - t < LOCKOUT_WINDOW_MS);
    return hits.length >= LOCKOUT_THRESHOLD;
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/** Creates a new analytics session row. Returns its id, or null if DB write failed. */
export async function createSession(
  meta: RequestMeta,
  invitationId: string | null,
  slug = PROPOSAL_SLUG,
): Promise<string | null> {
  try {
    const s = await prisma.proposalSession.create({
      data: {
        slug,
        invitationId: invitationId ?? undefined,
        ipHash: meta.ipHash,
        country: meta.country ?? undefined,
        region: meta.region ?? undefined,
        device: meta.device,
        browser: meta.browser,
        userAgent: meta.userAgent ?? undefined,
      },
      select: { id: true },
    });
    return s.id;
  } catch {
    return null;
  }
}

export interface VisitResolution {
  sessionId: string | null;
  rotated: boolean; // a new session was started (return visit)
}

/**
 * Resolves the session for the current browsing occasion. If the existing
 * session has been idle beyond the gap (or is missing), starts a new one and
 * flags it as a return visit. Called by the event beacon so cookie rotation
 * happens inside a route handler.
 */
export async function resolveVisit(
  existingSessionId: string | null,
  invitationId: string | null,
  meta: RequestMeta,
  slug = PROPOSAL_SLUG,
): Promise<VisitResolution> {
  try {
    if (existingSessionId) {
      const existing = await prisma.proposalSession.findUnique({
        where: { id: existingSessionId },
        select: { id: true, lastSeenAt: true },
      });
      if (existing && Date.now() - existing.lastSeenAt.getTime() < SESSION_GAP_MS) {
        await prisma.proposalSession.update({
          where: { id: existing.id },
          data: { lastSeenAt: new Date() },
        });
        return { sessionId: existing.id, rotated: false };
      }
      // Idle gap exceeded (or the row is gone) → a fresh browsing occasion.
      const fresh = await createSession(meta, invitationId, slug);
      if (fresh && existing) {
        await recordEvent(fresh, invitationId, "return_visit");
      }
      return { sessionId: fresh, rotated: true };
    }
    const fresh = await createSession(meta, invitationId, slug);
    return { sessionId: fresh, rotated: true };
  } catch {
    return { sessionId: existingSessionId, rotated: false };
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function recordEvent(
  sessionId: string | null,
  invitationId: string | null,
  kind: ProposalEventKind,
  opts: { sectionId?: string; detail?: string } = {},
  slug = PROPOSAL_SLUG,
): Promise<void> {
  try {
    await prisma.proposalEvent.create({
      data: {
        slug,
        sessionId: sessionId ?? undefined,
        invitationId: invitationId ?? undefined,
        kind,
        sectionId: opts.sectionId,
        detail: opts.detail,
      },
    });
    // Mirror two engagement signals onto the session row for fast reads.
    if (sessionId && (kind === "reached_close" || kind === "pdf_download")) {
      await prisma.proposalSession.update({
        where: { id: sessionId },
        data: kind === "reached_close" ? { reachedClose: true } : { downloadedPdf: true },
      });
    }
  } catch {
    // best-effort
  }
}

/** Touches lastSeenAt without recording an event (debounced section pings). */
export async function touchSession(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    await prisma.proposalSession.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
  } catch {
    // best-effort
  }
}
